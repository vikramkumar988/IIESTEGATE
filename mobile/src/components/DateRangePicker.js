import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../theme';

const PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 Days' },
  { key: 'thisWeek', label: 'This Week' },
  { key: 'last30', label: 'Last 30 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'custom', label: 'Custom Date' },
];

function getPresetDates(key) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: y, to: y };
    }
    case 'last7': {
      const d = new Date(today);
      d.setDate(d.getDate() - 6);
      return { from: d, to: today };
    }
    case 'thisWeek': {
      const d = new Date(today);
      d.setDate(d.getDate() - d.getDay() + (d.getDay() === 0 ? -6 : 1));
      return { from: d, to: today };
    }
    case 'last30': {
      const d = new Date(today);
      d.setDate(d.getDate() - 29);
      return { from: d, to: today };
    }
    case 'thisMonth': {
      const d = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: d, to: today };
    }
    default:
      return { from: today, to: today };
  }
}

function formatDate(date) {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toAPIDate(date) {
  return date.toISOString().split('T')[0];
}

export default function DateRangePicker({ onDateChange, initialPreset = 'today', compact = false }) {
  const [selectedPreset, setSelectedPreset] = useState(initialPreset);
  const [showPicker, setShowPicker] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [dateRange, setDateRange] = useState(getPresetDates(initialPreset));

  const handlePresetSelect = (key) => {
    if (key === 'custom') {
      setShowPicker(true);
      return;
    }
    setSelectedPreset(key);
    const dates = getPresetDates(key);
    setDateRange(dates);
    setShowPicker(false);
    onDateChange?.({
      date_from: toAPIDate(dates.from),
      date_to: toAPIDate(dates.to),
      preset: key,
    });
  };

  const handleCustomDate = (type, dateStr) => {
    if (type === 'from') setCustomFrom(dateStr);
    else setCustomTo(dateStr);
  };

  const applyCustomDate = () => {
    if (!customFrom || !customTo) return;
    const from = new Date(customFrom);
    const to = new Date(customTo);
    if (from > to) return;
    setSelectedPreset('custom');
    setDateRange({ from, to });
    setShowPicker(false);
    onDateChange?.({
      date_from: toAPIDate(from),
      date_to: toAPIDate(to),
      preset: 'custom',
    });
  };

  const presetLabel = PRESETS.find(p => p.key === selectedPreset)?.label || 'Today';

  if (compact) {
    return (
      <View>
        <TouchableOpacity style={styles.compactBtn} onPress={() => setShowPicker(true)}>
          <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
          <Text style={styles.compactText}>{presetLabel}</Text>
          <Text style={styles.compactDate}>{formatDate(dateRange.from)}{dateRange.from.getTime() !== dateRange.to.getTime() ? ` → ${formatDate(dateRange.to)}` : ''}</Text>
          <Ionicons name="chevron-down" size={12} color={Colors.textMuted} />
        </TouchableOpacity>

        <Modal visible={showPicker} transparent animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowPicker(false)}>
            <View style={styles.pickerContainer} onStartShouldSetResponder={() => true}>
              <Text style={styles.pickerTitle}>Select Date Range</Text>
              <View style={styles.presetGrid}>
                {PRESETS.filter(p => p.key !== 'custom').map(p => (
                  <TouchableOpacity
                    key={p.key}
                    style={[styles.presetChip, selectedPreset === p.key && styles.presetChipActive]}
                    onPress={() => handlePresetSelect(p.key)}
                  >
                    <Text style={[styles.presetChipText, selectedPreset === p.key && styles.presetChipTextActive]}>{p.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.customSection}>
                <Text style={styles.customLabel}>Custom Range</Text>
                <View style={styles.customRow}>
                  <View style={styles.customInputWrap}>
                    <Text style={styles.customInputLabel}>From</Text>
                    <TouchableOpacity style={styles.customInput} onPress={() => {
                      const today = new Date();
                      const val = customFrom || toAPIDate(today);
                      setCustomFrom(val);
                    }}>
                      <Text style={styles.customInputText}>{customFrom || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>
                  </View>
                  <Ionicons name="arrow-forward" size={16} color={Colors.textMuted} />
                  <View style={styles.customInputWrap}>
                    <Text style={styles.customInputLabel}>To</Text>
                    <TouchableOpacity style={styles.customInput} onPress={() => {
                      const val = customTo || toAPIDate(new Date());
                      setCustomTo(val);
                    }}>
                      <Text style={styles.customInputText}>{customTo || 'YYYY-MM-DD'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {(customFrom && customTo) && (
                  <TouchableOpacity style={styles.applyBtn} onPress={applyCustomDate}>
                    <Text style={styles.applyBtnText}>Apply Custom Range</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.presetsRow}>
        {PRESETS.filter(p => p.key !== 'custom').map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.presetPill, selectedPreset === p.key && styles.presetPillActive]}
            onPress={() => handlePresetSelect(p.key)}
          >
            <Text style={[styles.presetPillText, selectedPreset === p.key && styles.presetPillTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.dateDisplay}>
        <Ionicons name="calendar" size={14} color={Colors.primary} />
        <Text style={styles.dateText}>
          {formatDate(dateRange.from)}{dateRange.from.getTime() !== dateRange.to.getTime() ? ` — ${formatDate(dateRange.to)}` : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  presetsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  presetPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  presetPillActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary + '50' },
  presetPillText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  presetPillTextActive: { color: Colors.primary },
  dateDisplay: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  dateText: { fontSize: 12, color: Colors.textSecondary, fontWeight: '600' },

  // Compact mode
  compactBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  compactText: { fontSize: 12, color: Colors.primary, fontWeight: '800' },
  compactDate: { flex: 1, fontSize: 11, color: Colors.textMuted, fontWeight: '600', textAlign: 'right' },

  // Picker modal
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  pickerContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 360, borderWidth: 1, borderColor: Colors.border },
  pickerTitle: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text, marginBottom: Spacing.md },
  presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg },
  presetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  presetChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  presetChipText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600' },
  presetChipTextActive: { color: Colors.primary, fontWeight: '800' },
  customSection: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  customLabel: { fontSize: 12, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInputWrap: { flex: 1 },
  customInputLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 4, fontWeight: '700' },
  customInput: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 10 },
  customInputText: { fontSize: 13, color: Colors.textSecondary },
  applyBtn: { marginTop: 12, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, paddingVertical: 10, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
