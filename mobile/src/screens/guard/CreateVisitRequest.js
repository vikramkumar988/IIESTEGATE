import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, Alert, Image, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Card, Header } from '../../components';
import { visitService, userService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function CreateVisitRequest({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffList, setShowStaffList] = useState(false);

  const [form, setForm] = useState({
    visitor_name: '', visitor_phone: '', visitor_id_type: '', visitor_id_number: '',
    staff_id: '', staff_name: '', purpose: '', notes: '', photo: null,
  });

  useEffect(() => { searchStaff(''); }, []);

  const searchStaff = async (query) => {
    try {
      const res = await userService.searchStaff({ search: query });
      setStaffList(res.data?.data?.staff || []);
    } catch (e) { console.log('Staff search error:', e); }
  };

  // --- Visitor auto-fill by phone ---
  const [visitorFound, setVisitorFound] = useState(null);
  const lookupTimer = useRef(null);

  const handlePhoneChange = useCallback((text) => {
    setForm(prev => ({ ...prev, visitor_phone: text }));
    setVisitorFound(null);

    // Clear previous timer
    if (lookupTimer.current) clearTimeout(lookupTimer.current);

    // Only lookup when phone has 10+ digits
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
                visitor_id_type: visitor.id_type || prev.visitor_id_type,
                visitor_id_number: visitor.id_number || prev.visitor_id_number,
              }));
            }
          }
        } catch (e) {
          console.log('Visitor lookup error:', e);
        }
      }, 500);
    }
  }, []);

  const handleStaffSearch = (text) => {
    setStaffSearch(text);
    setShowStaffList(true);
    searchStaff(text);
  };

  const selectStaff = (staff) => {
    setForm({ ...form, staff_id: staff.id, staff_name: `${staff.full_name} (${staff.department})` });
    setStaffSearch(staff.full_name);
    setShowStaffList(false);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to capture visitor photo.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.7,
    });
    if (!result.canceled) {
      setForm({ ...form, photo: result.assets[0] });
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: true, aspect: [3, 4], quality: 0.7,
    });
    if (!result.canceled) {
      setForm({ ...form, photo: result.assets[0] });
    }
  };

  const validateStep = () => {
    if (step === 1) {
      if (!form.visitor_name.trim()) return Alert.alert('Error', 'Visitor name is required');
      if (!form.visitor_phone.trim()) return Alert.alert('Error', 'Phone number is required');
      setStep(2);
    } else if (step === 2) {
      if (!form.staff_id) return Alert.alert('Error', 'Please select a professor/staff');
      if (!form.purpose.trim()) return Alert.alert('Error', 'Purpose is required');
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    if (!form.photo) return Alert.alert('Error', 'Please capture visitor photo');

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('visitor_name', form.visitor_name);
      formData.append('visitor_phone', form.visitor_phone);
      formData.append('visitor_id_type', form.visitor_id_type);
      formData.append('visitor_id_number', form.visitor_id_number);
      formData.append('staff_id', form.staff_id);
      formData.append('purpose', form.purpose);
      formData.append('notes', form.notes);
      formData.append('photo', {
        uri: form.photo.uri,
        type: 'image/jpeg',
        name: 'visitor_photo.jpg',
      });

      await visitService.create(formData);
      Alert.alert('Success ✅', 'Visit request sent to professor!', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="New Visit Request" leftIcon="arrow-back" onLeftPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()} />

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        {[1, 2, 3].map((s) => (
          <View key={s} style={styles.progressStep}>
            <View style={[styles.progressDot, s <= step && styles.progressDotActive]}>
              {s < step ? <Ionicons name="checkmark" size={14} color={Colors.text} /> :
                <Text style={[styles.progressDotText, s <= step && { color: Colors.text }]}>{s}</Text>}
            </View>
            <Text style={[styles.progressLabel, s <= step && { color: Colors.text }]}>
              {s === 1 ? 'Visitor' : s === 2 ? 'Details' : 'Photo'}
            </Text>
            {s < 3 && <View style={[styles.progressLine, s < step && styles.progressLineActive]} />}
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Visitor Information</Text>
            <Input label="Phone Number *" icon="call-outline" placeholder="+91 XXXXXXXXXX"
              value={form.visitor_phone} onChangeText={handlePhoneChange} keyboardType="phone-pad" />

            {/* Returning visitor banner */}
            {visitorFound && !visitorFound._blacklisted && (
              <View style={styles.returningBanner}>
                <Ionicons name="person-circle" size={20} color="#22c55e" />
                <Text style={styles.returningText}>Returning visitor — details auto-filled!</Text>
              </View>
            )}
            {visitorFound && visitorFound._blacklisted && (
              <View style={[styles.returningBanner, styles.blacklistBanner]}>
                <Ionicons name="warning" size={20} color="#ef4444" />
                <Text style={[styles.returningText, { color: '#ef4444' }]}>⚠️ This visitor is blacklisted</Text>
              </View>
            )}

            <Input label="Full Name *" icon="person-outline" placeholder="Enter visitor's name"
              value={form.visitor_name} onChangeText={t => setForm({ ...form, visitor_name: t })} />
            <Input label="ID Type (Optional)" icon="card-outline" placeholder="Aadhaar / PAN / Driving License"
              value={form.visitor_id_type} onChangeText={t => setForm({ ...form, visitor_id_type: t })} />
            <Input label="ID Number (Optional)" icon="document-text-outline" placeholder="Enter ID number"
              value={form.visitor_id_number} onChangeText={t => setForm({ ...form, visitor_id_number: t })} />
            <Button title="Next →" onPress={validateStep} style={{ marginTop: Spacing.sm }} />
          </Card>
        )}

        {step === 2 && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Visit Details</Text>
            <View style={styles.staffSearchContainer}>
              <Input label="Professor / Staff *" icon="school-outline" placeholder="Search by name..."
                value={staffSearch} onChangeText={handleStaffSearch} onFocus={() => setShowStaffList(true)} />
              {showStaffList && staffList.length > 0 && (
                <View style={styles.staffDropdown}>
                  <FlatList
                    data={staffList}
                    keyExtractor={(item) => item.id}
                    style={{ maxHeight: 280 }}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item: s }) => {
                      const avail = s.availability || 'available';
                      const availColor = avail === 'available' ? '#22c55e' : avail === 'in_meeting' ? '#f59e0b' : avail === 'on_leave' ? '#3b82f6' : '#ef4444';
                      const availLabel = avail === 'available' ? '✓ Available' : avail === 'in_meeting' ? '⏳ In Meeting' : avail === 'on_leave' ? '✈ On Leave' : '✗ Unavailable';
                      const isUnavailable = avail === 'unavailable' || avail === 'on_leave';
                      return (
                        <TouchableOpacity style={[styles.staffItem, isUnavailable && { backgroundColor: availColor + '08' }]} onPress={() => selectStaff(s)}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.staffItemName}>{s.full_name}</Text>
                            <Text style={styles.staffItemDept}>{s.department} • {s.designation}</Text>
                          </View>
                          <View style={{ backgroundColor: availColor + '20', borderWidth: 1, borderColor: availColor + '50', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                            <Text style={{ fontSize: 11, color: availColor, fontWeight: '800' }}>{availLabel}</Text>
                          </View>
                        </TouchableOpacity>
                      );
                    }}
                  />
                </View>
              )}
            </View>
            {form.staff_name ? (
              <View style={styles.selectedStaff}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.selectedStaffText}>{form.staff_name}</Text>
              </View>
            ) : null}
            <Input label="Purpose of Visit *" icon="document-text-outline" placeholder="Describe the purpose..."
              value={form.purpose} onChangeText={t => setForm({ ...form, purpose: t })} multiline numberOfLines={3}
              containerStyle={{ marginTop: Spacing.sm }} />
            <Input label="Additional Notes" icon="chatbox-outline" placeholder="Any extra info..."
              value={form.notes} onChangeText={t => setForm({ ...form, notes: t })} multiline />
            <Button title="Next →" onPress={validateStep} style={{ marginTop: Spacing.sm }} />
          </Card>
        )}

        {step === 3 && (
          <Card style={styles.formCard}>
            <Text style={styles.formTitle}>Capture Visitor Photo</Text>
            {form.photo ? (
              <View style={styles.photoPreview}>
                <Image source={{ uri: form.photo.uri }} style={styles.previewImage} />
                <TouchableOpacity style={styles.retakeBtn} onPress={() => setForm({ ...form, photo: null })}>
                  <Ionicons name="refresh" size={18} color={Colors.text} />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.photoCapture}>
                <Ionicons name="camera" size={64} color={Colors.textMuted} />
                <Text style={styles.captureText}>Capture a live photo of the visitor</Text>
                <Button title="Open Camera" icon="camera" onPress={pickImage}
                  style={{ marginTop: Spacing.base, width: '80%' }} />
                <Button title="From Gallery" icon="images" variant="outline" onPress={pickFromGallery}
                  style={{ marginTop: Spacing.sm, width: '80%' }} />
              </View>
            )}
            <View style={styles.summaryBox}>
              <Text style={styles.summaryTitle}>Request Summary</Text>
              <Text style={styles.summaryItem}>👤 {form.visitor_name} • {form.visitor_phone}</Text>
              <Text style={styles.summaryItem}>🎓 To: {form.staff_name}</Text>
              <Text style={styles.summaryItem}>📋 {form.purpose}</Text>
            </View>
            <Button title="Submit Request" onPress={handleSubmit} loading={loading} variant="success"
              icon="send" size="lg" style={{ marginTop: Spacing.base }} />
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },

  progressContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.base },
  progressStep: { flexDirection: 'row', alignItems: 'center' },
  progressDot: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.surface,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border,
  },
  progressDotActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  progressDotText: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '700' },
  progressLine: { width: 40, height: 2, backgroundColor: Colors.border, marginHorizontal: 4 },
  progressLineActive: { backgroundColor: Colors.primary },
  progressLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, marginLeft: 4, marginRight: 8, fontWeight: '600' },

  formCard: { padding: Spacing.lg },
  formTitle: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '800', marginBottom: Spacing.lg },

  staffSearchContainer: { position: 'relative', zIndex: 10 },
  staffDropdown: {
    position: 'absolute', top: 76, left: 0, right: 0, zIndex: 20,
    backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, maxHeight: 300,
  },
  staffItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  staffItemName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600' },
  staffItemDept: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },

  selectedStaff: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.success + '15',
    padding: Spacing.md, borderRadius: BorderRadius.base, marginBottom: Spacing.sm,
  },
  selectedStaffText: { color: Colors.success, fontSize: FontSizes.sm, fontWeight: '600', marginLeft: Spacing.sm },

  photoCapture: { alignItems: 'center', paddingVertical: Spacing.xxl, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed', marginBottom: Spacing.base },
  captureText: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.sm },
  photoPreview: { alignItems: 'center', marginBottom: Spacing.base },
  previewImage: { width: 200, height: 260, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm },
  retakeBtn: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm },
  retakeText: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '600', marginLeft: 4 },

  summaryBox: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  summaryTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '700', marginBottom: Spacing.sm },
  summaryItem: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginBottom: 4 },

  returningBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)', borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm },
  blacklistBanner: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  returningText: { color: '#22c55e', fontSize: FontSizes.sm, fontWeight: '700', flex: 1 },
});
