import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, Alert, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, Header, EmptyState, LoadingScreen, Button } from '../../components';
import { visitService, generalVisitService, gatePassService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const TYPE_TABS = [
  { key: 'professor', label: 'Professor Visits', icon: 'school' },
  { key: 'general', label: 'General Visits', icon: 'people' },
];

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Expired' },
  { key: 'cancelled', label: 'Cancelled' },
];

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
];

function formatLocalDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDateRange(filter) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (filter) {
    case 'today':
      return { date_from: formatLocalDate(today), date_to: formatLocalDate(today) };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { date_from: formatLocalDate(yesterday), date_to: formatLocalDate(yesterday) };
    }
    case 'week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      return { date_from: formatLocalDate(weekStart), date_to: formatLocalDate(today) };
    }
    default:
      return {};
  }
}

function formatResponseTime(minutes) {
  if (!minutes && minutes !== 0) return null;
  const m = Math.round(minutes);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeDateTime(value, fallback = '—') {
  const d = safeDate(value);
  return d ? d.toLocaleString('en-IN') : fallback;
}

function safeTime(value, fallback = '—') {
  const d = safeDate(value);
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : fallback;
}

function resolvePhotoUrl(path) {
  if (!path) return null;
  if (typeof path === 'string' && (path.startsWith('http://') || path.startsWith('https://'))) return path;
  return `${getBaseUrl()}${path}`;
}

export default function GuardHistory({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [typeTab, setTypeTab] = useState('professor');

  const loadData = useCallback(async () => {
    try {
      const dateRange = getDateRange(dateFilter);
      const params = { limit: 100, ...dateRange };
      if (activeTab !== 'all') params.status = activeTab;

      if (typeTab === 'professor') {
        const res = await visitService.guardHistory(params);
        setVisits(res.data?.data?.visits || []);
        setSummary(res.data?.data?.summary || {});
      } else {
        const res = await generalVisitService.getAll(params);
        const gVisits = res.data?.data?.visits || [];
        setVisits(gVisits);
        setSummary({
          total: gVisits.length,
          approved: gVisits.filter(v => v.status === 'approved' || v.status === 'entered').length,
          rejected: gVisits.filter(v => v.status === 'rejected' || v.status === 'revoked').length,
          pending: gVisits.filter(v => v.status === 'pending').length,
        });
      }
    } catch (e) { console.log('GuardHistory error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab, dateFilter, typeTab]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  // Generate QR — detects professor vs general visit and uses correct endpoint
  const generateQR = async (visit) => {
    try {
      let res;
      if (typeTab === 'general') {
        // General visit — use generateGeneral endpoint
        res = await gatePassService.generateGeneral(visit.id);
      } else {
        // Professor visit — use standard generate endpoint
        res = await gatePassService.generate(visit.id);
      }
      const pass = res.data?.data?.gate_pass;
      if (pass) navigation.navigate('GenerateQR', { pass });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to generate pass');
    }
  };

  // Send SMS — uses gate_pass_id from API when available, otherwise generates first
  const handleSendSMS = async (visit) => {
    try {
      let passId = visit.gate_pass_id; // From the API response (general visits)
      
      if (!passId) {
        // Need to generate/get the pass first
        let passRes;
        if (typeTab === 'general') {
          passRes = await gatePassService.generateGeneral(visit.id);
        } else {
          passRes = await gatePassService.generate(visit.id);
        }
        const pass = passRes.data?.data?.gate_pass;
        passId = pass?.id;
      }

      if (passId) {
        const smsRes = await gatePassService.sendSMS(passId);
        Alert.alert(smsRes.data?.success ? '✅ SMS Sent' : '⚠️ SMS Failed', smsRes.data?.message || 'Check SMS service');
      } else {
        Alert.alert('Error', 'No gate pass found for this visit');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send SMS');
    }
  };

  const getStatusColor = (status) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'expired', cancelled: 'cancelled' };
    return map[status] || 'primary';
  };

  // Group visits by date for section headers
  const getDateLabel = (dateStr) => {
    const d = safeDate(dateStr);
    if (!d) return 'Unknown Date';
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // Add date section headers to the list with unique keys
  const getListData = () => {
    const items = [];
    let lastDate = '';
    let headerCounter = 0;
    for (const v of visits) {
      const dateLabel = getDateLabel(v.created_at);
      if (dateLabel !== lastDate) {
        headerCounter++;
        items.push({ type: 'header', label: dateLabel, id: `header-${headerCounter}-${dateLabel}` });
        lastDate = dateLabel;
      }
      items.push({ type: 'visit', ...v });
    }
    return items;
  };

  if (loading) return <LoadingScreen />;

  const renderItem = ({ item, index }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
          <Text style={styles.dateHeaderText}>{item.label}</Text>
        </View>
      );
    }

    const v = item;
    return (
      <Card style={styles.card}>
        <View style={styles.row}>
          {v.visitor_photo ? (
            <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.thumb} />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Ionicons name="person" size={22} color={Colors.textMuted} />
            </View>
          )}

          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <View style={styles.topRow}>
              <View style={styles.nameWithBadge}>
                <Text style={styles.name} numberOfLines={1}>{v.visitor_name}</Text>
                {v.visit_count > 1 && (
                  <View style={styles.repeatBadge}>
                    <Text style={styles.repeatBadgeText}>{v.visit_count}x</Text>
                  </View>
                )}
              </View>
              <Badge text={v.status} variant={getStatusColor(v.status)} size="sm" />
            </View>

            {/* Phone with quick dial */}
            <View style={styles.phoneLine}>
              <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.meta}>{v.visitor_phone}</Text>
              <TouchableOpacity onPress={() => v.visitor_phone && Linking.openURL(`tel:${v.visitor_phone}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="call" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>

            {!v.staff_name && v.purpose_detail && <Text style={styles.meta}>🏷️ Details: {v.purpose_detail}</Text>}
            {v.staff_name && <Text style={styles.meta}>🎓 To: {v.staff_name} {v.staff_department ? `(${v.staff_department})` : ''}</Text>}
            <Text style={styles.meta}>📋 {v.purpose}</Text>
            {/* Show which guard created it */}
            {v.guard_name && <Text style={styles.guardMeta}>🛡️ Guard: {v.guard_name}</Text>}
            <Text style={styles.time}>{safeDateTime(v.created_at)}</Text>

            {/* Response time */}
            {v.response_time_minutes != null && (
              <View style={styles.responseTimePill}>
                <Ionicons name="timer-outline" size={11} color="#a78bfa" />
                <Text style={styles.responseTimeText}>
                  Staff responded in {formatResponseTime(v.response_time_minutes)}
                </Text>
              </View>
            )}

            {/* Entry/Exit Timeline for approved passes */}
            {v.status === 'approved' && (v.entry_time || v.pass_code) && (
              <View style={styles.passTimeline}>
                <View style={styles.timelineRow}>
                  {v.entry_time ? (
                    <View style={[styles.timelinePill, styles.timelinePillActive]}>
                      <Ionicons name="log-in" size={12} color="#22c55e" />
                      <Text style={[styles.timelinePillText, { color: '#22c55e' }]}>
                        In {new Date(v.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.timelinePill}>
                      <Ionicons name="log-in-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.timelinePillText}>Not entered</Text>
                    </View>
                  )}
                  <Ionicons name="arrow-forward" size={10} color={Colors.textMuted} />
                  {v.exit_time ? (
                    <View style={[styles.timelinePill, styles.timelinePillActive]}>
                      <Ionicons name="log-out" size={12} color="#3b82f6" />
                      <Text style={[styles.timelinePillText, { color: '#3b82f6' }]}>
                        Out {new Date(v.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  ) : v.entry_time ? (
                    <View style={[styles.timelinePill, { borderColor: '#f59e0b50', backgroundColor: '#f59e0b10' }]}>
                      <Text style={[styles.timelinePillText, { color: '#f59e0b' }]}>⏳ Inside</Text>
                    </View>
                  ) : (
                    <View style={styles.timelinePill}>
                      <Ionicons name="log-out-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.timelinePillText}>—</Text>
                    </View>
                  )}
                </View>
                {/* SMS status */}
                {v.sms_sent != null && (
                  <View style={styles.smsPill}>
                    <Ionicons name={v.sms_sent ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={11} color={v.sms_sent ? '#22c55e' : Colors.textMuted} />
                    <Text style={[styles.smsPillText, { color: v.sms_sent ? '#22c55e' : Colors.textMuted }]}>
                      {v.sms_sent ? 'SMS sent to visitor' : 'SMS not sent'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Approved: show validity + Generate QR + Send SMS */}
            {v.status === 'approved' && (
              <View>
                {v.responded_at && (
                  <Text style={styles.approvedInfo}>✅ Approved at {new Date(v.responded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                )}
                {v.valid_until && (
                  <Text style={[styles.validityInfo, { color: new Date(v.valid_until) < new Date() ? '#ef4444' : '#22c55e' }]}>
                    {new Date(v.valid_until) < new Date() ? '⏰ Expired' : '🕐 Valid until'} {safeTime(v.valid_until)}
                  </Text>
                )}
                <View style={styles.approvedActions}>
                  <TouchableOpacity style={styles.qrBtn} onPress={() => generateQR(v)}>
                    <Ionicons name="qr-code" size={14} color={Colors.success} />
                    <Text style={[styles.qrBtnText, { color: Colors.success }]}>View QR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.smsBtn} onPress={() => handleSendSMS(v)}>
                    <Ionicons name="chatbubble-outline" size={14} color="#a78bfa" />
                    <Text style={[styles.qrBtnText, { color: '#a78bfa' }]}>Send SMS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {v.approval_message && (
              <View style={styles.msgBox}>
                <Text style={styles.msgLabel}>Staff message:</Text>
                <Text style={styles.msgText}>{v.approval_message}</Text>
              </View>
            )}
            {v.reject_reason && (
              <Text style={styles.rejectReason}>Reason: {v.reject_reason}</Text>
            )}
            {v.status === 'pending' && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.editLink} onPress={() => navigation.navigate('EditVisitRequest', { requestId: v.id })}>
                  <Ionicons name="create-outline" size={14} color={Colors.primary} />
                  <Text style={styles.editLinkText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
            {v.status === 'expired' && (
              <TouchableOpacity style={styles.reRaiseLink} onPress={async () => {
                try {
                  await visitService.reRaise(v.id);
                  Alert.alert('Success', 'Request re-raised! Staff re-notified.');
                  loadData();
                } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
              }}>
                <Ionicons name="refresh" size={14} color={Colors.warning} />
                <Text style={[styles.editLinkText, { color: Colors.warning }]}>Re-raise</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="All Requests" />

      {/* Type Tabs */}
      <View style={styles.typeRow}>
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.typeTab, typeTab === tab.key && styles.typeTabActive]}
            onPress={() => setTypeTab(tab.key)}>
            <Ionicons name={tab.icon} size={16} color={typeTab === tab.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.typeText, typeTab === tab.key && styles.typeTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <View style={[styles.summaryChip, { borderColor: Colors.primary }]}>
          <Text style={[styles.summaryNum, { color: Colors.primary }]}>{summary.total || 0}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.success }]}>
          <Text style={[styles.summaryNum, { color: Colors.success }]}>{summary.approved || 0}</Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.danger }]}>
          <Text style={[styles.summaryNum, { color: Colors.danger }]}>{summary.rejected || 0}</Text>
          <Text style={styles.summaryLabel}>Rejected</Text>
        </View>
        <View style={[styles.summaryChip, { borderColor: Colors.warning }]}>
          <Text style={[styles.summaryNum, { color: Colors.warning }]}>{summary.pending || 0}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
      </View>

      {/* Date Filter Chips */}
      <View style={styles.dateFilterRow}>
        {DATE_FILTERS.map((df) => (
          <TouchableOpacity
            key={df.key}
            style={[styles.dateChip, dateFilter === df.key && styles.dateChipActive]}
            onPress={() => setDateFilter(df.key)}
          >
            <Text style={[styles.dateChipText, dateFilter === df.key && styles.dateChipTextActive]}>{df.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Tabs — use ScrollView instead of FlatList to avoid VirtualizedList nesting */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.tabActive]} onPress={() => setActiveTab(tab.key)}>
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={getListData()}
        keyExtractor={(item, index) => item.type === 'header' ? item.id : `visit-${item.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline"
            title={activeTab === 'all' ? 'No requests found' : `No ${activeTab} requests`}
            message={dateFilter === 'today' ? 'No requests for today. Try a different date range.' : 'Try changing the date filter'} />
        }
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        windowSize={5}
        removeClippedSubviews={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.base, paddingBottom: 40 },

  typeRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeTab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  typeTabActive: { borderBottomColor: Colors.primary },
  typeText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  typeTextActive: { color: Colors.primary },

  // Summary row
  summaryRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingTop: Spacing.sm, gap: 8 },
  summaryChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  summaryNum: { fontSize: FontSizes.lg, fontWeight: '900' },
  summaryLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

  // Date filter chips
  dateFilterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: 8 },
  dateChip: { flex: 1, paddingVertical: 8, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  dateChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  dateChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  dateChipTextActive: { color: Colors.primary },

  // Date section headers
  dateHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 4, marginTop: 4 },
  dateHeaderText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '800', letterSpacing: 0.5 },

  // Tab bar — using View instead of FlatList to avoid VirtualizedList nesting
  tabBar: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabScroll: { flexDirection: 'row', paddingHorizontal: Spacing.base, gap: Spacing.xs },
  tab: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },

  card: { padding: Spacing.base, marginBottom: Spacing.sm },
  row: { flexDirection: 'row' },
  thumb: { width: 56, height: 72, borderRadius: BorderRadius.sm },
  thumbPlaceholder: { width: 56, height: 72, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nameWithBadge: { flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: Spacing.sm, gap: 5 },
  name: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700', flexShrink: 1 },

  // Repeat visitor badge
  repeatBadge: { backgroundColor: '#a78bfa20', borderWidth: 1, borderColor: '#a78bfa50', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  repeatBadgeText: { fontSize: 9, color: '#a78bfa', fontWeight: '800' },

  // Phone line with dial
  phoneLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },

  meta: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  guardMeta: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 2, fontStyle: 'italic' },
  time: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 4 },
  approvedInfo: { color: Colors.success, fontSize: FontSizes.sm, marginTop: 4, fontWeight: '600' },
  validityInfo: { fontSize: FontSizes.xs, marginTop: 2, fontWeight: '700' },
  rejectReason: { color: Colors.danger, fontSize: FontSizes.sm, fontStyle: 'italic', marginTop: Spacing.xs },

  // Response time
  responseTimePill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: '#a78bfa12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#a78bfa25', alignSelf: 'flex-start' },
  responseTimeText: { fontSize: 10, color: '#a78bfa', fontWeight: '700' },

  // Pass entry/exit timeline
  passTimeline: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timelinePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight },
  timelinePillActive: { borderColor: '#22c55e40', backgroundColor: '#22c55e08' },
  timelinePillText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },

  // SMS status
  smsPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  smsPillText: { fontSize: 10, fontWeight: '700' },

  // Approved action buttons
  approvedActions: { flexDirection: 'row', gap: 10, marginTop: Spacing.sm },
  qrBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.md, backgroundColor: Colors.success + '12', borderWidth: 1, borderColor: Colors.success + '30' },
  smsBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.md, backgroundColor: '#a78bfa12', borderWidth: 1, borderColor: '#a78bfa30' },
  qrBtnText: { fontSize: 12, fontWeight: '700' },

  msgBox: { marginTop: Spacing.xs, paddingLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: Colors.success },
  msgLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },
  msgText: { color: Colors.textSecondary, fontSize: FontSizes.sm },

  actionRow: { flexDirection: 'row', marginTop: Spacing.sm, gap: Spacing.md },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLinkText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },
  reRaiseLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm },
});
