import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Badge, Button, LoadingScreen } from '../../components';
import { visitService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';




export default function RequestDetail({ navigation, route }) {
  const { requestId } = route.params;
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [validityHours, setValidityHours] = useState(4);
  const [meetingLoading, setMeetingLoading] = useState(false);

  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => { loadRequest(); }, []);

  const loadRequest = async () => {
    try {
      const res = await visitService.getById(requestId);
      setRequest(res.data.data.visit_request);
    } catch (e) {
      Alert.alert('Error', 'Failed to load request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Base URL imported

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await visitService.approve(requestId, { validity_hours: validityHours, message: approvalMessage.trim() || undefined });
      Alert.alert('Success ✅', 'Visit request approved');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      await visitService.reject(requestId, { reason: rejectReason.trim() || undefined });
      Alert.alert('Done', 'Visit request rejected');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    Alert.alert('Cancel Request', 'Are you sure? The guard will be notified to recheck visitor details.', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes, Cancel', style: 'destructive', onPress: async () => {
        setActionLoading(true);
        try {
          await visitService.cancel(requestId, { reason: cancelReason.trim() || 'Wrong/incorrect visitor details' });
          Alert.alert('Done', 'Request cancelled. Guard has been notified.');
          navigation.goBack();
        } catch (e) {
          Alert.alert('Error', e.response?.data?.message || 'Failed to cancel');
        } finally {
          setActionLoading(false);
        }
      }},
    ]);
  };

  const handleConfirmMeeting = async (status) => {
    const label = status === 'met' ? 'Met' : 'Did Not Meet';
    Alert.alert(
      'Confirm Meeting Status',
      `Mark this visitor as "${label}"? This cannot be changed afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setMeetingLoading(true);
            try {
              await visitService.confirmMeeting(requestId, { meeting_status: status });
              Alert.alert('Done ✅', `Meeting status marked as: ${label}`);
              loadRequest();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to update meeting status');
            } finally {
              setMeetingLoading(false);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'expired', cancelled: 'cancelled' };
    return map[status] || 'primary';
  };

  if (loading) return <LoadingScreen />;
  if (!request) return null;

  return (
    <View style={styles.container}>
      <Header title="Request Details" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Status Badge */}
        <View style={styles.statusRow}>
          <Badge text={request.status} variant={getStatusColor(request.status)} />
          <Text style={styles.timestamp}>{new Date(request.created_at).toLocaleString('en-IN')}</Text>
        </View>

        {/* Visitor Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Visitor Information</Text>
          {request.visitor_photo && (
            <Image source={{ uri: resolvePhotoUrl(request.visitor_photo) }} style={styles.visitorPhoto} />
          )}
          <DetailRow icon="person" label="Name" value={request.visitor_name} />
          <DetailRow icon="call" label="Phone" value={request.visitor_phone} />
          {request.visitor_id_type && <DetailRow icon="card" label="ID Type" value={request.visitor_id_type} />}
          {request.visitor_id_number && <DetailRow icon="document" label="ID Number" value={request.visitor_id_number} />}
          {request.visitor_address && <DetailRow icon="location" label="Address" value={request.visitor_address} />}
        </Card>

        {/* Visit Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Visit Details</Text>
          <DetailRow icon="document-text" label="Purpose" value={request.purpose} />
          {request.notes && <DetailRow icon="create" label="Notes" value={request.notes} />}
        </Card>

        {/* Guard Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Guard Information</Text>
          <DetailRow icon="shield" label="Guard" value={request.guard_name} />
          <DetailRow icon="business" label="Gate" value={request.gate_assigned || 'Not assigned'} />
        </Card>

        {/* Staff Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Staff Information</Text>
          <DetailRow icon="person" label="Staff" value={request.staff_name} />
          <DetailRow icon="school" label="Department" value={request.staff_department || '-'} />
          {request.staff_designation && <DetailRow icon="ribbon" label="Designation" value={request.staff_designation} />}
        </Card>

        {/* Approval Message */}
        {request.approval_message && (
          <Card style={[styles.section, { borderLeftWidth: 3, borderLeftColor: Colors.success }]}>
            <Text style={styles.sectionTitle}>Approval Message</Text>
            <Text style={styles.messageText}>{request.approval_message}</Text>
          </Card>
        )}

        {/* Reject Reason */}
        {request.reject_reason && (
          <Card style={[styles.section, { borderLeftWidth: 3, borderLeftColor: Colors.danger }]}>
            <Text style={styles.sectionTitle}>Rejection Reason</Text>
            <Text style={styles.messageText}>{request.reject_reason}</Text>
          </Card>
        )}

        {/* Timestamps */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Timeline</Text>
          <DetailRow icon="time" label="Requested" value={new Date(request.requested_at).toLocaleString('en-IN')} />
          {request.responded_at && <DetailRow icon="checkmark-circle" label="Responded" value={new Date(request.responded_at).toLocaleString('en-IN')} />}
          {request.valid_until && <DetailRow icon="alarm" label="Valid Until" value={new Date(request.valid_until).toLocaleString('en-IN')} />}
          {request.meeting_confirmed_at && <DetailRow icon="people" label="Meeting Confirmed" value={new Date(request.meeting_confirmed_at).toLocaleString('en-IN')} />}
        </Card>

        {/* Meeting Confirmation — only for approved requests */}
        {request.status === 'approved' && (
          <Card style={[styles.section, styles.meetingCard]}>
            <Text style={styles.sectionTitle}>Meeting Confirmation</Text>
            <Text style={styles.meetingDesc}>
              Did <Text style={{ fontWeight: '800', color: '#fff' }}>{request.visitor_name}</Text> actually come and meet you?
            </Text>

            {request.meeting_status === 'not_confirmed' ? (
              <View style={styles.meetingBtnRow}>
                <Button
                  title="✅  Met"
                  variant="success"
                  onPress={() => handleConfirmMeeting('met')}
                  loading={meetingLoading}
                  style={{ flex: 1 }}
                />
                <Button
                  title="❌  Did Not Meet"
                  variant="danger"
                  onPress={() => handleConfirmMeeting('not_met')}
                  loading={meetingLoading}
                  style={{ flex: 1, marginLeft: 10 }}
                />
              </View>
            ) : (
              <View style={[
                styles.meetingResultBanner,
                { backgroundColor: request.meeting_status === 'met' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  borderColor: request.meeting_status === 'met' ? '#22c55e' : '#ef4444' }
              ]}>
                <Ionicons
                  name={request.meeting_status === 'met' ? 'checkmark-circle' : 'close-circle'}
                  size={24}
                  color={request.meeting_status === 'met' ? '#22c55e' : '#ef4444'}
                />
                <Text style={[styles.meetingResultText, { color: request.meeting_status === 'met' ? '#22c55e' : '#ef4444' }]}>
                  {request.meeting_status === 'met' ? 'Visitor met you ✅' : 'Visitor did NOT meet you ❌'}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* Action Buttons for Pending Requests */}
        {request.status === 'pending' && (
          <Card style={styles.actionSection}>
            <Text style={styles.sectionTitle}>Take Action</Text>

            {/* Approve Section */}
            <View style={styles.actionBlock}>
              <Text style={styles.actionLabel}>Validity Duration</Text>
              <View style={styles.validityRow}>
                {[2, 4, 6, 8].map((h) => (
                  <View key={h} style={[styles.validityChip, validityHours === h && styles.validityChipActive]}>
                    <Text style={[styles.validityText, validityHours === h && { color: Colors.text }]} onPress={() => setValidityHours(h)}>{h}h</Text>
                  </View>
                ))}
              </View>

              <TextInput
                style={styles.messageInput}
                placeholder="Add a message for the guard (optional)"
                placeholderTextColor={Colors.textMuted}
                value={approvalMessage}
                onChangeText={setApprovalMessage}
                multiline
              />

              <Button title="Approve Request" icon="checkmark" variant="success" onPress={handleApprove} loading={actionLoading} style={{ marginTop: Spacing.md }} />
            </View>

            {/* Reject Section */}
            <View style={[styles.actionBlock, { marginTop: Spacing.lg }]}>
              <TextInput
                style={styles.messageInput}
                placeholder="Reason for rejection (optional)"
                placeholderTextColor={Colors.textMuted}
                value={rejectReason}
                onChangeText={setRejectReason}
                multiline
              />
              <Button title="Reject Request" icon="close" variant="danger" onPress={handleReject} loading={actionLoading} style={{ marginTop: Spacing.md }} />
            </View>

            {/* Cancel Section — Wrong Details */}
            <View style={[styles.actionBlock, { marginTop: Spacing.lg, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border }]}>
              <Text style={styles.actionLabel}>⚠️ Wrong Visitor Details?</Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Reason for cancellation (e.g. wrong phone number)"
                placeholderTextColor={Colors.textMuted}
                value={cancelReason}
                onChangeText={setCancelReason}
                multiline
              />
              <Button title="Cancel — Incorrect Details" icon="alert-circle" variant="outline" onPress={handleCancel} loading={actionLoading} style={{ marginTop: Spacing.md }} />
            </View>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  timestamp: { color: Colors.textMuted, fontSize: FontSizes.sm },

  section: { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },

  visitorPhoto: { width: 100, height: 130, borderRadius: BorderRadius.md, marginBottom: Spacing.md },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  detailLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600', width: 90 },
  detailValue: { color: Colors.text, fontSize: FontSizes.base, flex: 1 },

  messageText: { color: Colors.text, fontSize: FontSizes.base, lineHeight: 22 },

  actionSection: { padding: Spacing.lg, marginBottom: Spacing.lg },
  actionBlock: {},
  actionLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.sm },

  validityRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  validityChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  validityChipActive: { backgroundColor: Colors.success + '20', borderColor: Colors.success },
  validityText: { color: Colors.textMuted, fontSize: FontSizes.base, fontWeight: '700' },

  messageInput: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.base, color: Colors.text, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 60, textAlignVertical: 'top' },

  meetingCard: { borderWidth: 1, borderColor: 'rgba(99,102,241,0.3)', backgroundColor: 'rgba(99,102,241,0.06)' },
  meetingDesc: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginBottom: Spacing.md, lineHeight: 20 },
  meetingBtnRow: { flexDirection: 'row', gap: 10 },
  meetingResultBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  meetingResultText: { fontSize: FontSizes.base, fontWeight: '700', flex: 1 },
});
