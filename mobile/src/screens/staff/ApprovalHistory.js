import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Image, TouchableOpacity, Linking, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, Header, EmptyState, LoadingScreen } from '../../components';
import { visitService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Missed' },
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

export default function ApprovalHistory({ navigation }) {
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');

  const loadData = useCallback(async () => {
    try {
      const dateRange = getDateRange(dateFilter);
      const params = { limit: 100, ...dateRange };
      if (activeTab !== 'all') params.status = activeTab;
      const res = await visitService.getHistory(params);
      setHistory(res.data?.data?.history || []);
      setSummary(res.data?.data?.summary || {});
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [activeTab, dateFilter]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  const getStatusColor = (status, respondedAt) => {
    if (status === 'expired') return respondedAt ? 'warning' : 'warning';
    const map = { approved: 'success', rejected: 'danger', expired: 'warning', cancelled: 'cancelled' };
    return map[status] || 'primary';
  };

  const formatTime = (dateStr) => {
    const d = safeDate(dateStr);
    if (!d) return '-';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' ' +
           d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  // Group records by date for section headers
  const getDateLabel = (dateStr) => {
    const d = safeDate(dateStr);
    if (!d) return 'Unknown Date';
    const today = new Date();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getListData = () => {
    const items = [];
    let lastDate = '';
    let headerCounter = 0;
    for (const h of history) {
      // Keep section headers aligned with backend date filtering (created_at).
      const dateLabel = getDateLabel(h.created_at);
      if (dateLabel !== lastDate) {
        headerCounter++;
        items.push({ type: 'header', label: dateLabel, id: `header-${headerCounter}-${dateLabel}` });
        lastDate = dateLabel;
      }
      items.push({ type: 'record', ...h });
    }
    return items;
  };

  if (loading) return <LoadingScreen />;

  const renderItem = ({ item }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.dateHeader}>
          <Ionicons name="calendar-outline" size={14} color={Colors.primary} />
          <Text style={styles.dateHeaderText}>{item.label}</Text>
        </View>
      );
    }

    const h = item;
    return (
      <Card key={h.id} style={styles.card} onPress={() => navigation.navigate('RequestDetail', { requestId: h.id })}>
        <View style={styles.cardHeader}>
          {/* Photo */}
          {h.visitor_photo ? (
            <Image source={{ uri: `${getBaseUrl()}${h.visitor_photo}` }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Ionicons name="person" size={24} color={Colors.textMuted} />
            </View>
          )}

          {/* Main Info */}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{h.visitor_name}</Text>
              {h.visit_count > 1 && (
                <View style={styles.repeatBadge}>
                  <Text style={styles.repeatBadgeText}>{h.visit_count}x</Text>
                </View>
              )}
              <Badge text={h.status === 'expired' ? (h.responded_at ? 'expired' : 'missed') : h.status} variant={getStatusColor(h.status, h.responded_at)} size="sm" />
            </View>
            <View style={styles.phoneLine}>
              <Text style={styles.phone}>📱 {h.visitor_phone}</Text>
              <TouchableOpacity onPress={() => h.visitor_phone && Linking.openURL(`tel:${h.visitor_phone}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="call" size={15} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.purpose} numberOfLines={1}>📋 {h.purpose}</Text>
          </View>
        </View>

        {/* Details Row */}
        <View style={styles.detailsRow}>
          <View style={styles.detail}>
            <Ionicons name="shield-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.detailText}>{h.guard_name}</Text>
          </View>
          {h.gate_assigned && (
            <View style={styles.detail}>
              <Ionicons name="business-outline" size={12} color={Colors.textMuted} />
              <Text style={styles.detailText}>{h.gate_assigned}</Text>
            </View>
          )}
          <View style={styles.detail}>
            <Ionicons name="time-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.detailText}>{formatTime(h.responded_at || h.created_at)}</Text>
          </View>
        </View>

        {/* Response Time + Validity Row */}
        <View style={styles.extraInfoRow}>
          {h.response_time_minutes != null && (
            <View style={styles.responseTimePill}>
              <Ionicons name="timer-outline" size={11} color="#a78bfa" />
              <Text style={styles.responseTimeText}>Responded in {formatResponseTime(h.response_time_minutes)}</Text>
            </View>
          )}
          {h.status === 'approved' && h.valid_until && (
            <View style={styles.validityPill}>
              <Ionicons name="hourglass-outline" size={11} color={new Date(h.valid_until) < new Date() ? '#ef4444' : '#22c55e'} />
              <Text style={[styles.validityText, { color: new Date(h.valid_until) < new Date() ? '#ef4444' : '#22c55e' }]}>
                Valid until {new Date(h.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          )}
        </View>

        {/* Entry/Exit Status */}
        {h.status === 'approved' && (h.entry_time || h.exit_time) && (
          <View style={styles.entryExitRow}>
            {h.entry_time && (
              <View style={styles.entryExitPill}>
                <Ionicons name="log-in-outline" size={12} color="#22c55e" />
                <Text style={[styles.entryExitText, { color: '#22c55e' }]}>
                  In: {new Date(h.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {h.exit_time && (
              <View style={styles.entryExitPill}>
                <Ionicons name="log-out-outline" size={12} color="#3b82f6" />
                <Text style={[styles.entryExitText, { color: '#3b82f6' }]}>
                  Out: {new Date(h.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
            {h.entry_time && !h.exit_time && new Date(h.valid_until) < new Date() && (
              <View style={[styles.entryExitPill, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b50' }]}>
                <Text style={{ fontSize: 10, color: '#f59e0b', fontWeight: '700' }}>⚠️ Still Inside</Text>
              </View>
            )}
            {h.sms_sent != null && (
              <View style={styles.entryExitPill}>
                <Ionicons name={h.sms_sent ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={11} color={h.sms_sent ? '#22c55e' : Colors.textMuted} />
                <Text style={[styles.entryExitText, { color: h.sms_sent ? '#22c55e' : Colors.textMuted }]}>
                  {h.sms_sent ? 'SMS Sent' : 'No SMS'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Messages */}
        {h.approval_message && (
          <View style={[styles.messageBox, { borderLeftColor: Colors.success }]}>
            <Text style={styles.messageLabel}>Your message:</Text>
            <Text style={styles.messageText} numberOfLines={2}>{h.approval_message}</Text>
          </View>
        )}
        {h.reject_reason && (
          <View style={[styles.messageBox, { borderLeftColor: Colors.danger }]}>
            <Text style={styles.messageLabel}>{h.status === 'cancelled' ? 'Cancel reason:' : 'Rejection reason:'}</Text>
            <Text style={styles.messageText} numberOfLines={2}>{h.reject_reason}</Text>
          </View>
        )}

        {/* Missed indicator */}
        {h.status === 'expired' && !h.responded_at && (
          <View style={styles.missedBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.warning} />
            <Text style={styles.missedText}>This request expired without a response</Text>
          </View>
        )}

        {/* Expired indicator */}
        {h.status === 'expired' && h.responded_at && (
          <View style={[styles.missedBanner, { borderTopColor: '#f59e0b50' }]}>
            <Ionicons name="time" size={16} color="#f59e0b" />
            <Text style={[styles.missedText, { color: '#f59e0b' }]}>This approved visit has expired</Text>
          </View>
        )}

        {/* Meeting status indicator for approved requests */}
        {h.status === 'approved' && (
          <View style={[
            styles.meetingPill,
            h.meeting_status === 'met'
              ? styles.meetingPillMet
              : h.meeting_status === 'not_met'
                ? styles.meetingPillNotMet
                : styles.meetingPillPending
          ]}>
            <Ionicons
              name={h.meeting_status === 'met' ? 'checkmark-circle' : h.meeting_status === 'not_met' ? 'close-circle' : 'help-circle-outline'}
              size={13}
              color={h.meeting_status === 'met' ? '#22c55e' : h.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted}
            />
            <Text style={[
              styles.meetingPillText,
              { color: h.meeting_status === 'met' ? '#22c55e' : h.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted }
            ]}>
              {h.meeting_status === 'met' ? 'Visitor met staff' : h.meeting_status === 'not_met' ? 'Visitor did not meet staff' : 'Meeting not confirmed yet'}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Request History" />

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
          <Text style={[styles.summaryNum, { color: Colors.warning }]}>{summary.expired || 0}</Text>
          <Text style={styles.summaryLabel}>Missed</Text>
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

      {/* Status Tabs */}
      <View style={styles.tabRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={getListData()}
        keyExtractor={(item, index) => item.type === 'header' ? item.id : `record-${item.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon={activeTab === 'expired' ? 'alert-circle-outline' : 'time-outline'}
            title={activeTab === 'expired' ? 'No missed requests' : 'No records'}
            message={dateFilter === 'today' ? 'No records for today. Try a different date range.' : 'Your request history will appear here'}
          />
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
  content: { padding: Spacing.base, paddingBottom: 40 },

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

  tabRow: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabScroll: { paddingHorizontal: Spacing.base, gap: Spacing.sm },
  tab: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.md, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  tabTextActive: { color: Colors.primary },

  card: { padding: Spacing.base, marginBottom: Spacing.sm },
  cardHeader: { flexDirection: 'row', gap: Spacing.md },
  photo: { width: 52, height: 65, borderRadius: BorderRadius.sm },
  photoPlaceholder: { width: 52, height: 65, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },

  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2, gap: 4 },
  name: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700', flex: 1, marginRight: Spacing.sm },
  phoneLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  phone: { color: Colors.textSecondary, fontSize: FontSizes.sm, flex: 1 },
  purpose: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },

  // Repeat badge
  repeatBadge: { backgroundColor: '#a78bfa20', borderWidth: 1, borderColor: '#a78bfa50', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1, marginRight: 4 },
  repeatBadgeText: { fontSize: 9, color: '#a78bfa', fontWeight: '800' },

  detailsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  detailText: { color: Colors.textMuted, fontSize: FontSizes.xs },

  // Extra info row (response time + validity)
  extraInfoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  responseTimePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#a78bfa12', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: '#a78bfa25' },
  responseTimeText: { fontSize: 10, color: '#a78bfa', fontWeight: '700' },
  validityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(34,197,94,0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  validityText: { fontSize: 10, fontWeight: '700' },

  // Entry/Exit row
  entryExitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  entryExitPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.border },
  entryExitText: { fontSize: 10, fontWeight: '700' },

  messageBox: { marginTop: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, paddingVertical: 4 },
  messageLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },
  messageText: { color: Colors.textSecondary, fontSize: FontSizes.sm },

  missedBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },
  missedText: { color: Colors.warning, fontSize: FontSizes.sm, fontWeight: '600' },

  meetingPill: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, paddingVertical: 4 },
  meetingPillMet: {},
  meetingPillNotMet: {},
  meetingPillPending: {},
  meetingPillText: { fontSize: FontSizes.xs, fontWeight: '600' },
});
