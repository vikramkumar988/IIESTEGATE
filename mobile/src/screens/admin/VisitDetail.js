import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Badge, LoadingScreen, Button } from '../../components';
import { visitService, gatePassService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function VisitDetail({ navigation, route }) {
  const { visitId } = route.params;
  const [visit, setVisit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadVisit(); }, []);

  const loadVisit = async () => {
    try {
      const res = await visitService.getById(visitId);
      setVisit(res.data.data.visit_request);
    } catch (e) {
      Alert.alert('Error', 'Failed to load visit details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'expired', cancelled: 'cancelled' };
    return map[status] || 'primary';
  };

  const getStatusIcon = (status) => {
    const map = { pending: 'hourglass', approved: 'checkmark-circle', rejected: 'close-circle', expired: 'alarm', cancelled: 'ban' };
    return map[status] || 'ellipse';
  };

  const getTimeSince = (dateStr) => {
    const ms = Date.now() - new Date(dateStr).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hrs > 24) return `${Math.floor(hrs / 24)}d ago`;
    if (hrs > 0) return `${hrs}h ${mins}m ago`;
    return `${mins}m ago`;
  };

  if (loading) return <LoadingScreen />;
  if (!visit) return null;

  return (
    <View style={styles.container}>
      <Header title="Visit Details" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={styles.statusLeft}>
            <Ionicons name={getStatusIcon(visit.status)} size={24} color={visit.status === 'approved' ? Colors.success : visit.status === 'rejected' ? Colors.danger : Colors.warning} />
            <Badge text={visit.status} variant={getStatusColor(visit.status)} />
          </View>
          <Text style={styles.timestamp}>{getTimeSince(visit.created_at)}</Text>
        </View>

        {/* Visitor Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Visitor Information</Text>
          </View>
          <View style={styles.visitorHeader}>
            {visit.visitor_photo ? (
              <Image source={{ uri: `${getBaseUrl()}${visit.visitor_photo}` }} style={styles.photo} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Ionicons name="person" size={36} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.visitorInfo}>
              <Text style={styles.visitorName}>{visit.visitor_name}</Text>
              <TouchableOpacity style={styles.phoneBtn} onPress={() => Linking.openURL(`tel:${visit.visitor_phone}`)}>
                <Ionicons name="call" size={14} color={Colors.primary} />
                <Text style={styles.phoneText}>{visit.visitor_phone}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {visit.visitor_id_type && <Row icon="card" label="ID Type" value={visit.visitor_id_type} />}
          {visit.visitor_id_number && <Row icon="document" label="ID No." value={visit.visitor_id_number} />}
          {visit.visitor_address && <Row icon="location" label="Address" value={visit.visitor_address} />}
        </Card>

        {/* Visit Info Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="document-text" size={18} color={Colors.secondary} />
            <Text style={styles.sectionTitle}>Visit Information</Text>
          </View>
          <Row icon="document-text" label="Purpose" value={visit.purpose} />
          {visit.notes && <Row icon="create" label="Notes" value={visit.notes} />}
        </Card>

        {/* Personnel Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people" size={18} color="#a78bfa" />
            <Text style={styles.sectionTitle}>Personnel</Text>
          </View>
          <Row icon="shield" label="Guard" value={visit.guard_name || 'N/A'} />
          {visit.gate_assigned && <Row icon="business" label="Gate" value={visit.gate_assigned} />}
          <View style={styles.divider} />
          <Row icon="school" label="Staff" value={visit.staff_name || 'N/A'} />
          {visit.staff_department && <Row icon="briefcase" label="Dept" value={visit.staff_department} />}
          {visit.staff_designation && <Row icon="ribbon" label="Desig." value={visit.staff_designation} />}
        </Card>

        {/* Approval / Rejection Messages */}
        {visit.approval_message && (
          <Card style={[styles.section, { borderLeftWidth: 3, borderLeftColor: Colors.success }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
              <Text style={styles.sectionTitle}>Approval Message</Text>
            </View>
            <Text style={styles.messageText}>{visit.approval_message}</Text>
          </Card>
        )}
        {visit.reject_reason && (
          <Card style={[styles.section, { borderLeftWidth: 3, borderLeftColor: Colors.danger }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="close-circle" size={18} color={Colors.danger} />
              <Text style={styles.sectionTitle}>Rejection Reason</Text>
            </View>
            <Text style={styles.messageText}>{visit.reject_reason}</Text>
          </Card>
        )}

        {/* Gate Pass Info (if approved) */}
        {visit.status === 'approved' && (visit.pass_code || visit.entry_time) && (
          <Card style={[styles.section, { borderLeftWidth: 3, borderLeftColor: Colors.secondary }]}>
            <View style={styles.sectionHeader}>
              <Ionicons name="qr-code" size={18} color={Colors.secondary} />
              <Text style={styles.sectionTitle}>Gate Pass</Text>
            </View>
            {visit.pass_code && <Row icon="card" label="Pass Code" value={visit.pass_code} mono />}
            {visit.sms_sent != null && (
              <Row icon={visit.sms_sent ? 'chatbubble-ellipses' : 'chatbubble-outline'}
                label="SMS"
                value={visit.sms_sent ? `Sent${visit.sms_sent_at ? ' at ' + new Date(visit.sms_sent_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}` : 'Not sent'} />
            )}

            {/* Entry / Exit Timeline */}
            <View style={styles.timelineSection}>
              <Text style={styles.timelineTitle}>Entry / Exit</Text>
              <View style={styles.timelineRow}>
                <View style={[styles.timelineNode, { backgroundColor: visit.entry_time ? '#22c55e' : Colors.surfaceLight }]}>
                  <Ionicons name="log-in" size={14} color={visit.entry_time ? '#fff' : Colors.textMuted} />
                </View>
                <View style={styles.timelineLine} />
                <View style={[styles.timelineNode, { backgroundColor: visit.exit_time ? '#3b82f6' : Colors.surfaceLight }]}>
                  <Ionicons name="log-out" size={14} color={visit.exit_time ? '#fff' : Colors.textMuted} />
                </View>
              </View>
              <View style={styles.timelineLabels}>
                <Text style={[styles.timelineLabel, visit.entry_time && { color: '#22c55e' }]}>
                  {visit.entry_time ? new Date(visit.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Not entered'}
                </Text>
                <Text style={[styles.timelineLabel, visit.exit_time && { color: '#3b82f6' }]}>
                  {visit.exit_time ? new Date(visit.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : visit.entry_time ? '⏳ Inside' : '—'}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Full Timeline Card */}
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={18} color={Colors.warning} />
            <Text style={styles.sectionTitle}>Timeline</Text>
          </View>
          <TimelineItem icon="create" color={Colors.primary} label="Request Created" time={visit.requested_at || visit.created_at} />
          {visit.responded_at && <TimelineItem icon="checkmark-done" color={Colors.success} label="Staff Responded" time={visit.responded_at} />}
          {visit.entry_time && <TimelineItem icon="log-in" color="#22c55e" label="Visitor Entered" time={visit.entry_time} />}
          {visit.exit_time && <TimelineItem icon="log-out" color="#3b82f6" label="Visitor Exited" time={visit.exit_time} />}
          {visit.valid_until && (
            <TimelineItem
              icon="alarm"
              color={new Date(visit.valid_until) < new Date() ? Colors.danger : Colors.success}
              label={new Date(visit.valid_until) < new Date() ? 'Pass Expired' : 'Valid Until'}
              time={visit.valid_until}
            />
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label, value, mono }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && { fontFamily: 'monospace', letterSpacing: 2 }]}>{value}</Text>
    </View>
  );
}

function TimelineItem({ icon, color, label, time }) {
  return (
    <View style={styles.timelineItem}>
      <View style={[styles.timelineIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={14} color={color} />
      </View>
      <View style={{ flex: 1, marginLeft: Spacing.md }}>
        <Text style={styles.timelineItemLabel}>{label}</Text>
        <Text style={styles.timelineItemTime}>{new Date(time).toLocaleString('en-IN')}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  // Status header
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg, paddingHorizontal: 4 },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timestamp: { color: Colors.textMuted, fontSize: FontSizes.sm },

  // Section card
  section: { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },

  // Visitor header in card
  visitorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  photo: { width: 80, height: 100, borderRadius: BorderRadius.md },
  photoPlaceholder: { width: 80, height: 100, borderRadius: BorderRadius.md, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  visitorInfo: { flex: 1, marginLeft: Spacing.lg },
  visitorName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900' },
  phoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: Colors.primary + '12', borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.primary + '30', marginTop: 8, alignSelf: 'flex-start' },
  phoneText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700' },

  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  // Detail rows
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  rowLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600', width: 80 },
  rowValue: { color: Colors.text, fontSize: FontSizes.base, flex: 1 },
  messageText: { color: Colors.text, fontSize: FontSizes.base, lineHeight: 22 },

  // Entry/Exit visual timeline
  timelineSection: { marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  timelineTitle: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '700', textTransform: 'uppercase', marginBottom: Spacing.md },
  timelineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 },
  timelineNode: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  timelineLine: { flex: 1, height: 3, backgroundColor: Colors.border, marginHorizontal: -2 },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  timelineLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },

  // Full timeline
  timelineItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
  timelineIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  timelineItemLabel: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  timelineItemTime: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 2 },
});
