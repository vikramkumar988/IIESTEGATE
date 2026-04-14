import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Header, Button, LoadingScreen } from '../../components';
import { incidentService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../theme';

const CATEGORIES = [
  { key: 'unauthorized_entry', label: 'Unauthorized Entry', icon: 'ban', color: '#ef4444' },
  { key: 'suspicious_activity', label: 'Suspicious Activity', icon: 'eye', color: '#f59e0b' },
  { key: 'theft', label: 'Theft / Loss', icon: 'bag-remove', color: '#8b5cf6' },
  { key: 'fight', label: 'Fight / Altercation', icon: 'flash', color: '#ec4899' },
  { key: 'medical', label: 'Medical Emergency', icon: 'medkit', color: '#22c55e' },
  { key: 'fire', label: 'Fire / Hazard', icon: 'flame', color: '#f97316' },
  { key: 'vandalism', label: 'Vandalism', icon: 'hammer', color: '#06b6d4' },
  { key: 'other', label: 'Other', icon: 'alert-circle', color: '#64748b' },
];

const SEVERITY = [
  { key: 'low', label: 'Low', color: '#22c55e' },
  { key: 'medium', label: 'Medium', color: '#f59e0b' },
  { key: 'high', label: 'High', color: '#f97316' },
  { key: 'critical', label: 'Critical', color: '#ef4444' },
];

export default function IncidentReportScreen({ navigation }) {
  const [category, setCategory] = useState(null);
  const [severity, setSeverity] = useState('medium');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
      base64: true,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      setPhoto(result.assets[0]);
    }
  };

  const handleSubmit = async () => {
    if (!category) return Alert.alert('Required', 'Please select an incident category');
    if (!description.trim()) return Alert.alert('Required', 'Please describe the incident');

    setSubmitting(true);
    try {
      const payload = {
        category,
        description: description.trim(),
        location: location.trim() || undefined,
        severity,
        photo_base64: photo?.base64 ? `data:image/jpeg;base64,${photo.base64}` : undefined,
      };

      await incidentService.create(payload);
      Alert.alert('✅ Reported', 'Incident has been reported and all admins have been notified.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to submit report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="Report Incident" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>All incidents are immediately reported to campus administration.</Text>
        </View>

        {/* Category Selection */}
        <Text style={styles.sectionLabel}>INCIDENT CATEGORY *</Text>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryCard, category === cat.key && { borderColor: cat.color, backgroundColor: cat.color + '10' }]}
              onPress={() => setCategory(cat.key)}
            >
              <View style={[styles.categoryIconWrap, { backgroundColor: cat.color + '15' }]}>
                <Ionicons name={cat.icon} size={22} color={cat.color} />
              </View>
              <Text style={[styles.categoryLabel, category === cat.key && { color: cat.color }]}>{cat.label}</Text>
              {category === cat.key && (
                <View style={[styles.categoryCheck, { backgroundColor: cat.color }]}>
                  <Ionicons name="checkmark" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Severity */}
        <Text style={styles.sectionLabel}>SEVERITY LEVEL</Text>
        <View style={styles.severityRow}>
          {SEVERITY.map((sev) => (
            <TouchableOpacity
              key={sev.key}
              style={[styles.severityChip, severity === sev.key && { backgroundColor: sev.color + '20', borderColor: sev.color }]}
              onPress={() => setSeverity(sev.key)}
            >
              <View style={[styles.severityDot, { backgroundColor: sev.color }]} />
              <Text style={[styles.severityText, severity === sev.key && { color: sev.color }]}>{sev.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Description */}
        <Text style={styles.sectionLabel}>DESCRIPTION *</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Describe what happened in detail..."
          placeholderTextColor={Colors.textMuted}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
        />

        {/* Location */}
        <Text style={styles.sectionLabel}>LOCATION</Text>
        <View style={styles.inputRow}>
          <Ionicons name="location-outline" size={18} color={Colors.textMuted} />
          <TextInput
            style={styles.locationInput}
            placeholder="e.g. Main Gate, Building A, Parking Area..."
            placeholderTextColor={Colors.textMuted}
            value={location}
            onChangeText={setLocation}
          />
        </View>

        {/* Photo */}
        <Text style={styles.sectionLabel}>PHOTO EVIDENCE</Text>
        <TouchableOpacity style={styles.photoBtn} onPress={pickImage}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="camera-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.photoPlaceholderText}>Tap to capture photo</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Submit */}
        <Button
          title={submitting ? 'Submitting...' : '🚨 Submit Incident Report'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!category || !description.trim()}
          variant="danger"
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '25', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.xl },
  infoText: { color: Colors.textSecondary, fontSize: FontSizes.sm, flex: 1 },
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.md },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryCard: { width: '47.5%', flexDirection: 'row', alignItems: 'center', gap: 10, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, position: 'relative' },
  categoryIconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  categoryLabel: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700', flex: 1 },
  categoryCheck: { position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.border },
  severityDot: { width: 8, height: 8, borderRadius: 4 },
  severityText: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  textArea: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.md, color: Colors.text, fontSize: FontSizes.base, minHeight: 120 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  locationInput: { flex: 1, paddingVertical: 14, color: Colors.text, fontSize: FontSizes.base },
  photoBtn: { borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: Colors.border, borderStyle: 'dashed', overflow: 'hidden' },
  photoPreview: { width: '100%', height: 200, resizeMode: 'cover' },
  photoPlaceholder: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, backgroundColor: Colors.surface },
  photoPlaceholderText: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 8 },
});
