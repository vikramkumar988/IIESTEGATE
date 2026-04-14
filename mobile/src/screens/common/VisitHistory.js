import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { visitService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';
import VisitCard from '../../components/VisitCard';

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expired', label: 'Missed' },
];

function formatLocalDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function formatDisplayDate(d) {
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export default function VisitHistory({ navigation }) {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const loadData = useCallback(async () => {
    try {
      const params = { date: formatLocalDate(selectedDate) };
      if (activeTab !== 'all') params.status = activeTab;
      const res = await visitService.getDailyRecords(params);
      setRecords(res.data?.data?.records || []);
      setSummary(res.data?.data?.summary || {});
    } catch (e) {
      console.log('VisitHistory error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, activeTab]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  const goToPrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const goToNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    const today = new Date();
    if (d <= today) setSelectedDate(d);
  };

  const goToToday = () => setSelectedDate(new Date());

  const isToday = selectedDate.toDateString() === new Date().toDateString();
  const role = user?.role;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📊 Visit Records</Text>
        <TouchableOpacity style={styles.todayBtn} onPress={goToToday}>
          <Text style={[styles.todayBtnText, isToday && { color: Colors.primary }]}>Today</Text>
        </TouchableOpacity>
      </View>

      {/* Date Selector */}
      <View style={styles.dateSelector}>
        <TouchableOpacity style={styles.dateArrow} onPress={goToPrevDay}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Ionicons name="calendar" size={16} color={Colors.primary} />
          <Text style={styles.dateText}>{formatDisplayDate(selectedDate)}</Text>
        </View>

        <TouchableOpacity style={[styles.dateArrow, isToday && { opacity: 0.3 }]} onPress={goToNextDay} disabled={isToday}>
          <Ionicons name="chevron-forward" size={22} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.primary }]}>{summary.total || 0}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.success }]}>{summary.approved || 0}</Text>
          <Text style={styles.statLabel}>Approved</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.danger }]}>{summary.rejected || 0}</Text>
          <Text style={styles.statLabel}>Rejected</Text>
        </View>
        <View style={[styles.statDivider]} />
        <View style={styles.statBox}>
          <Text style={[styles.statNum, { color: Colors.warning }]}>{summary.pending || 0}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Status Tabs */}
      <View style={styles.tabRow}>
        {STATUS_TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Records List */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading records...</Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <VisitCard
              visit={item}
              showStaff={role !== 'staff'}
              showGuard={role !== 'guard'}
              onPress={() => navigation.navigate('RequestDetail', { requestId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="document-text-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No records for this date</Text>
              <Text style={styles.emptyMsg}>Try selecting a different date</Text>
            </View>
          }
          initialNumToRender={8}
          maxToRenderPerBatch={5}
          windowSize={5}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md,
  },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: '900', color: Colors.text },
  todayBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  todayBtnText: { fontSize: FontSizes.sm, fontWeight: '700', color: Colors.textSecondary },

  dateSelector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.md,
  },
  dateArrow: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.xs },
  dateCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateText: { fontSize: FontSizes.lg, fontWeight: '800', color: Colors.text },

  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: Colors.border, paddingVertical: Spacing.md,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: FontSizes.xl, fontWeight: '900' },
  statLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  statDivider: { width: 1, height: 28, backgroundColor: Colors.border },

  tabRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    gap: 6,
  },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 8,
    borderRadius: BorderRadius.sm, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '50' },
  tabText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  tabTextActive: { color: Colors.primary, fontWeight: '800' },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40, paddingTop: Spacing.sm },

  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingTop: 80 },
  loadingText: { color: Colors.textMuted, fontSize: FontSizes.sm },

  emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: { color: Colors.textSecondary, fontSize: FontSizes.lg, fontWeight: '700' },
  emptyMsg: { color: Colors.textMuted, fontSize: FontSizes.sm },
});
