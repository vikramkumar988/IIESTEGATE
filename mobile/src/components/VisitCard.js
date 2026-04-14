import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius } from '../theme';
import { resolvePhotoUrl } from '../utils/photoUrl';

function safeTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatResponseTime(minutes) {
  if (!minutes && minutes !== 0) return null;
  const m = Math.round(minutes);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m} min`;
}

const STATUS_CONFIG = {
  pending: { color: Colors.warning, label: 'PENDING', icon: 'hourglass' },
  approved: { color: Colors.success, label: 'APPROVED', icon: 'checkmark-circle' },
  rejected: { color: Colors.danger, label: 'REJECTED', icon: 'close-circle' },
  expired: { color: '#F59E0B', label: 'EXPIRED', icon: 'time' },
  cancelled: { color: Colors.textMuted, label: 'CANCELLED', icon: 'ban' },
};

export default function VisitCard({ visit, onPress, showStaff = true, showGuard = true, compact = false }) {
  const v = visit;
  const sc = STATUS_CONFIG[v.status] || STATUS_CONFIG.pending;
  const isApproved = v.status === 'approved' || (v.status === 'expired' && v.responded_at);
  const meetIcon = v.meeting_status === 'met' ? 'checkmark-circle' : v.meeting_status === 'not_met' ? 'close-circle' : 'help-circle-outline';
  const meetColor = v.meeting_status === 'met' ? Colors.success : v.meeting_status === 'not_met' ? Colors.danger : Colors.textMuted;
  const meetLabel = v.meeting_status === 'met' ? 'Met Staff' : v.meeting_status === 'not_met' ? 'Did Not Meet' : 'Not Confirmed';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      {/* Top Row: Photo + Info + Status */}
      <View style={styles.topRow}>
        {v.visitor_photo ? (
          <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="person" size={22} color={Colors.textMuted} />
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{v.visitor_name}</Text>
            {v.visit_count > 1 && (
              <View style={styles.repeatBadge}>
                <Text style={styles.repeatText}>{v.visit_count}x</Text>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.phoneRow} onPress={() => v.visitor_phone && Linking.openURL(`tel:${v.visitor_phone}`)}>
            <Ionicons name="call-outline" size={11} color={Colors.textMuted} />
            <Text style={styles.phone}>{v.visitor_phone}</Text>
            <Ionicons name="call" size={12} color={Colors.primary} />
          </TouchableOpacity>

          <Text style={styles.purpose} numberOfLines={1}>📋 {v.purpose}</Text>
        </View>

        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: sc.color + '18', borderColor: sc.color + '40' }]}>
          <Ionicons name={sc.icon} size={10} color={sc.color} />
          <Text style={[styles.statusText, { color: sc.color }]}>{sc.label}</Text>
        </View>
      </View>

      {/* Detail Chips Row */}
      <View style={styles.chipRow}>
        {showStaff && v.staff_name && (
          <View style={styles.chip}>
            <Ionicons name="school-outline" size={10} color={Colors.violet} />
            <Text style={[styles.chipText, { color: Colors.violet }]}>{v.staff_name}</Text>
          </View>
        )}
        {showGuard && v.guard_name && (
          <View style={styles.chip}>
            <Ionicons name="shield-outline" size={10} color={Colors.sky} />
            <Text style={[styles.chipText, { color: Colors.sky }]}>{v.guard_name}</Text>
          </View>
        )}
        {v.gate_assigned && (
          <View style={styles.chip}>
            <Ionicons name="business-outline" size={10} color={Colors.textMuted} />
            <Text style={styles.chipText}>{v.gate_assigned}</Text>
          </View>
        )}
        <View style={styles.chip}>
          <Ionicons name="time-outline" size={10} color={Colors.textMuted} />
          <Text style={styles.chipText}>{safeTime(v.requested_at || v.created_at) || '—'}</Text>
        </View>
        {v.response_time_minutes != null && (
          <View style={[styles.chip, { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '25' }]}>
            <Ionicons name="timer-outline" size={10} color={Colors.primary} />
            <Text style={[styles.chipText, { color: Colors.primary }]}>{formatResponseTime(v.response_time_minutes)}</Text>
          </View>
        )}
      </View>

      {/* Entry / Exit / Met Row — only for approved visits */}
      {isApproved && (
        <View style={styles.trackingRow}>
          {/* Entry */}
          <View style={[styles.trackPill, v.entry_time ? styles.trackActive : null]}>
            <Ionicons name={v.entry_time ? 'log-in' : 'log-in-outline'} size={12}
              color={v.entry_time ? Colors.success : Colors.textMuted} />
            <Text style={[styles.trackText, v.entry_time && { color: Colors.success }]}>
              {v.entry_time ? `In ${safeTime(v.entry_time)}` : 'No Entry'}
            </Text>
          </View>

          {/* Arrow */}
          <Ionicons name="arrow-forward" size={10} color={Colors.textMuted} />

          {/* Exit */}
          <View style={[styles.trackPill, v.exit_time ? styles.trackActiveBlue : v.entry_time && !v.exit_time ? styles.trackWarning : null]}>
            <Ionicons name={v.exit_time ? 'log-out' : 'log-out-outline'} size={12}
              color={v.exit_time ? Colors.info : v.entry_time && !v.exit_time ? Colors.warning : Colors.textMuted} />
            <Text style={[styles.trackText,
              v.exit_time && { color: Colors.info },
              v.entry_time && !v.exit_time && { color: Colors.warning }]}>
              {v.exit_time ? `Out ${safeTime(v.exit_time)}` : v.entry_time ? '⏳ Inside' : 'No Exit'}
            </Text>
          </View>

          {/* Met Status */}
          <View style={[styles.trackPill, { borderColor: meetColor + '30', backgroundColor: meetColor + '08' }]}>
            <Ionicons name={meetIcon} size={12} color={meetColor} />
            <Text style={[styles.trackText, { color: meetColor }]}>{meetLabel}</Text>
          </View>
        </View>
      )}

      {/* Messages */}
      {v.approval_message && (
        <View style={[styles.msgBox, { borderLeftColor: Colors.success }]}>
          <Text style={styles.msgText}>💬 {v.approval_message}</Text>
        </View>
      )}
      {v.reject_reason && (
        <View style={[styles.msgBox, { borderLeftColor: Colors.danger }]}>
          <Text style={styles.msgText}>❌ {v.reject_reason}</Text>
        </View>
      )}

      {/* Missed/Expired labels */}
      {v.status === 'expired' && !v.responded_at && (
        <View style={styles.alertRow}>
          <Ionicons name="alert-circle" size={13} color={Colors.warning} />
          <Text style={styles.alertText}>Request expired without response</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  topRow: { flexDirection: 'row', gap: Spacing.md },
  photo: { width: 50, height: 62, borderRadius: BorderRadius.sm },
  photoPlaceholder: { width: 50, height: 62, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700', flex: 1 },
  repeatBadge: { backgroundColor: Colors.primary + '20', borderWidth: 1, borderColor: Colors.primary + '40', borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  repeatText: { fontSize: 9, color: Colors.primary, fontWeight: '800' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  phone: { color: Colors.textSecondary, fontSize: FontSizes.sm, flex: 1 },
  purpose: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },

  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1, alignSelf: 'flex-start',
  },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 5, backgroundColor: Colors.surfaceLight, borderWidth: 1, borderColor: Colors.border,
  },
  chipText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },

  trackingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border,
    flexWrap: 'wrap',
  },
  trackPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight,
  },
  trackActive: { borderColor: Colors.success + '40', backgroundColor: Colors.success + '08' },
  trackActiveBlue: { borderColor: Colors.info + '40', backgroundColor: Colors.info + '08' },
  trackWarning: { borderColor: Colors.warning + '40', backgroundColor: Colors.warning + '08' },
  trackText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },

  msgBox: { marginTop: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, paddingVertical: 3 },
  msgText: { color: Colors.textSecondary, fontSize: FontSizes.sm },

  alertRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  alertText: { color: Colors.warning, fontSize: FontSizes.sm, fontWeight: '600' },
});
