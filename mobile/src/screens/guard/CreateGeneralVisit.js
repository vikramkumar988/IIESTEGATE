import React, { useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card, Header, Badge } from '../../components';
import { generalVisitService, gatePassService, visitService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const PURPOSES = [
  { id: 'bank', label: 'Bank', icon: 'cash' },
  { id: 'post_office', label: 'Post Office', icon: 'mail' },
  { id: 'canteen', label: 'Canteen', icon: 'restaurant' },
  { id: 'library', label: 'Library', icon: 'library' },
  { id: 'admin_office', label: 'Admin Office', icon: 'business' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal' },
];

const VALIDITY_OPTIONS = [
  { hours: 1, label: '1 Hour' },
  { hours: 2, label: '2 Hours' },
  { hours: 4, label: '4 Hours' },
  { hours: 8, label: 'Full Day' },
];

export default function CreateGeneralVisit({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    visitor_name: '', visitor_phone: '', purpose: '', purpose_detail: '',
    validity_hours: 2, photo: null, vehicle_number: '', vehicle_type: 'none',
  });
  const [qrData, setQrData] = useState(null);

  // --- Visitor auto-fill by phone ---
  const [visitorFound, setVisitorFound] = useState(null);
  const lookupTimer = useRef(null);

  const handlePhoneChange = useCallback((text) => {
    setForm(prev => ({ ...prev, visitor_phone: text }));
    setVisitorFound(null);

    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    const digits = text.replace(/\D/g, '');
    if (digits.length >= 10) {
      lookupTimer.current = setTimeout(async () => {
        try {
          const res = await visitService.lookupVisitor(text.trim());
          const visitor = res.data?.data?.visitor;
          if (visitor) {
            if (visitor.is_blacklisted) {
              setVisitorFound({ ...visitor, _blacklisted: true });
              Alert.alert('⚠️ Blacklisted Visitor', `This visitor is blacklisted.${visitor.blacklist_reason ? ' Reason: ' + visitor.blacklist_reason : ''}`);
            } else {
              setVisitorFound(visitor);
              setForm(prev => ({
                ...prev,
                visitor_name: visitor.full_name || prev.visitor_name,
              }));
            }
          }
        } catch (e) {
          console.log('Visitor lookup error:', e);
        }
      }, 500);
    }
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission Required', 'Camera access needed');
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [3, 4], quality: 0.7 });
    if (!result.canceled) setForm({ ...form, photo: result.assets[0] });
  };

  const handleSubmit = async () => {
    if (!form.visitor_name.trim()) return Alert.alert('Error', 'Visitor name required');
    if (!form.visitor_phone.trim()) return Alert.alert('Error', 'Phone number required');
    if (!form.purpose) return Alert.alert('Error', 'Select a purpose');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('visitor_name', form.visitor_name);
      formData.append('visitor_phone', form.visitor_phone);
      formData.append('purpose', form.purpose);
      formData.append('purpose_detail', form.purpose_detail);
      formData.append('validity_hours', form.validity_hours);
      if (form.vehicle_number.trim()) formData.append('vehicle_number', form.vehicle_number.trim());
      if (form.vehicle_type !== 'none') formData.append('vehicle_type', form.vehicle_type);
      if (form.photo) {
        formData.append('photo', { uri: form.photo.uri, type: 'image/jpeg', name: 'visitor.jpg' });
      }

      const res = await generalVisitService.create(formData);
      const visit = res.data?.data?.general_visit;
      const pass = res.data?.data?.gate_pass;
      const smsStatus = res.data?.data?.sms_status;

      // The backend API already generates the gate pass internally
      if (pass) {
        if (smsStatus && !smsStatus.success) {
          Alert.alert('Info', 'Pass generated, but SMS failed to send: ' + smsStatus.message);
        }
        setQrData(pass);
      } else {
        // Fallback just in case
        const passRes = await gatePassService.generateGeneral(visit.id);
        setQrData(passRes.data?.data?.gate_pass);
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create visit');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  // Show QR result
  if (qrData) {
    return (
      <View style={styles.container}>
        <Header title="Pass Generated ✅" />
        <ScrollView contentContainerStyle={styles.qrContent}>
          <View style={styles.qrCard}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.success} />
            <Text style={styles.qrTitle}>Pass Ready!</Text>
            <Text style={styles.qrName}>{form.visitor_name}</Text>
            <Badge text={form.purpose} variant="primary" />
            {qrData.qr_data && (
              <Image source={{ uri: qrData.qr_data }} style={styles.qrImage} />
            )}
            <Text style={styles.qrCode}>{qrData.pass_code}</Text>
            <Text style={styles.qrExpiry}>
              Valid until: {new Date(qrData.valid_until).toLocaleString('en-IN')}
            </Text>
          </View>
          <Button title="Done" onPress={() => navigation.goBack()} icon="checkmark" size="lg" style={{ marginTop: Spacing.lg }} />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="General Visit Pass" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Visitor Details</Text>
          <Input label="Phone *" icon="call-outline" placeholder="+91 XXXXXXXXXX"
            value={form.visitor_phone} onChangeText={handlePhoneChange} keyboardType="phone-pad" />

          {/* Returning visitor banner */}
          {visitorFound && !visitorFound._blacklisted && (
            <View style={styles.returningBanner}>
              <Ionicons name="person-circle" size={20} color="#22c55e" />
              <Text style={styles.returningText}>Returning visitor — name auto-filled!</Text>
            </View>
          )}
          {visitorFound && visitorFound._blacklisted && (
            <View style={[styles.returningBanner, styles.blacklistBanner]}>
              <Ionicons name="warning" size={20} color="#ef4444" />
              <Text style={[styles.returningText, { color: '#ef4444' }]}>⚠️ Blacklisted visitor</Text>
            </View>
          )}

          <Input label="Full Name *" icon="person-outline" placeholder="Visitor name"
            value={form.visitor_name} onChangeText={t => setForm({ ...form, visitor_name: t })} />
        </Card>

        <Card>
          <Text style={styles.formTitle}>Purpose of Visit</Text>
          <View style={styles.purposeGrid}>
            {PURPOSES.map((p) => (
              <TouchableOpacity key={p.id} style={[styles.purposeChip, form.purpose === p.id && styles.purposeChipActive]}
                onPress={() => setForm({ ...form, purpose: p.id })}>
                <Ionicons name={p.icon} size={20} color={form.purpose === p.id ? Colors.text : Colors.textMuted} />
                <Text style={[styles.purposeLabel, form.purpose === p.id && { color: Colors.text }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.purpose === 'other' && (
            <Input placeholder="Specify purpose..." value={form.purpose_detail}
              onChangeText={t => setForm({ ...form, purpose_detail: t })} containerStyle={{ marginTop: Spacing.sm }} />
          )}
        </Card>

        <Card>
          <Text style={styles.formTitle}>Validity Duration</Text>
          <View style={styles.validityRow}>
            {VALIDITY_OPTIONS.map((v) => (
              <TouchableOpacity key={v.hours}
                style={[styles.validityChip, form.validity_hours === v.hours && styles.validityChipActive]}
                onPress={() => setForm({ ...form, validity_hours: v.hours })}>
                <Text style={[styles.validityLabel, form.validity_hours === v.hours && { color: Colors.text }]}>
                  {v.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Card>
          <Text style={styles.formTitle}>Visitor Photo (Optional)</Text>
          {form.photo ? (
            <View style={styles.photoPreview}>
              <Image source={{ uri: form.photo.uri }} style={styles.previewImg} />
              <TouchableOpacity onPress={() => setForm({ ...form, photo: null })}>
                <Text style={{ color: Colors.danger, marginTop: Spacing.sm }}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Button title="Capture Photo" icon="camera" variant="outline" onPress={pickImage} />
          )}
        </Card>

        {/* Vehicle Info */}
        <Card>
          <Text style={styles.formTitle}>Vehicle Details (Optional)</Text>
          <View style={styles.validityRow}>
            {['none', 'car', 'bike', 'auto', 'other'].map((vt) => (
              <TouchableOpacity key={vt}
                style={[styles.validityChip, form.vehicle_type === vt && styles.validityChipActive]}
                onPress={() => setForm({ ...form, vehicle_type: vt })}>
                <Text style={[styles.validityLabel, form.vehicle_type === vt && { color: Colors.text }]}>
                  {vt === 'none' ? 'None' : vt.charAt(0).toUpperCase() + vt.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.vehicle_type !== 'none' && (
            <Input label="Vehicle Number" icon="car-outline" placeholder="e.g. WB 12 AB 3456"
              value={form.vehicle_number} onChangeText={t => setForm({ ...form, vehicle_number: t })}
              autoCapitalize="characters" containerStyle={{ marginTop: Spacing.sm }} />
          )}
        </Card>

        <Button title="Generate Pass Instantly" onPress={handleSubmit} loading={loading}
          variant="success" icon="qr-code" size="lg" style={{ marginTop: Spacing.sm, marginBottom: Spacing.xxl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },
  formCard: { padding: Spacing.lg },
  formTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.base },

  purposeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  purposeChip: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  purposeChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  purposeLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600', marginLeft: Spacing.xs },

  validityRow: { flexDirection: 'row', gap: Spacing.sm },
  validityChip: {
    flex: 1, paddingVertical: Spacing.md, alignItems: 'center',
    backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
  },
  validityChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  validityLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },

  photoPreview: { alignItems: 'center' },
  previewImg: { width: 150, height: 200, borderRadius: BorderRadius.md },

  qrContent: { padding: Spacing.lg, alignItems: 'center' },
  qrCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xxl,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border, width: '100%',
  },
  qrTitle: { color: Colors.success, fontSize: FontSizes.xxl, fontWeight: '800', marginTop: Spacing.base },
  qrName: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '700', marginVertical: Spacing.sm },
  qrImage: { width: 250, height: 250, marginVertical: Spacing.lg },
  qrCode: { color: Colors.textSecondary, fontSize: FontSizes.md, fontWeight: '700', letterSpacing: 2 },
  qrExpiry: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: Spacing.sm },

  returningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  blacklistBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  returningText: { color: '#22c55e', fontSize: FontSizes.sm, fontWeight: '700', flex: 1 },
});
