import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, EmptyState, LoadingScreen } from '../../components';
import { dashboardService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function DayWiseRecords({ navigation }) {
  const [records, setRecords] = useState([]);
  const [generalRecords, setGeneralRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  const loadData = useCallback(async () => {
    try {
      const res = await dashboardService.getDayWise({ days });
      setRecords(res.data?.data?.visit_requests || []);
      setGeneralRecords(res.data?.data?.general_visits || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [days]);

  useEffect(() => { loadData(); }, [loadData]);

  const getGeneralCount = (date) => {
    const found = generalRecords.find(r => r.date?.split('T')[0] === date?.split('T')[0]);
    return found ? parseInt(found.total) : 0;
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Day-Wise Records" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        {/* Time Range Selector */}
        <View style={styles.filterRow}>
          {[7, 15, 30, 60].map((d) => (
            <TouchableOpacity key={d} style={[styles.filterChip, days === d && styles.filterChipActive]} onPress={() => { setDays(d); setLoading(true); }}>
              <Text style={[styles.filterText, days === d && styles.filterTextActive]}>{d}d</Text>
            </TouchableOpacity>
          ))}
        </View>

        {records.length === 0 ? (
          <EmptyState icon="calendar-outline" title="No records" message={`No visit requests in the last ${days} days`} />
        ) : (
          records.map((record) => {
            const generalCount = getGeneralCount(record.date);
            const total = parseInt(record.total_requests) + generalCount;
            return (
              <Card key={record.date} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View>
                    <Text style={styles.dayDate}>{formatDate(record.date)}</Text>
                    <Text style={styles.daySubtext}>{new Date(record.date).toLocaleDateString('en-IN')}</Text>
                  </View>
                  <View style={styles.totalBadge}>
                    <Text style={styles.totalCount}>{total}</Text>
                    <Text style={styles.totalLabel}>total</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <StatItem label="Prof. Requests" value={record.total_requests} color={Colors.primary} />
                  <StatItem label="General" value={generalCount} color={Colors.secondary} />
                  <StatItem label="Approved" value={record.approved} color={Colors.success} />
                  <StatItem label="Rejected" value={record.rejected} color={Colors.danger} />
                  <StatItem label="Pending" value={record.pending} color={Colors.warning} />
                  <StatItem label="Expired" value={record.expired} color={Colors.textMuted} />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

function StatItem({ label, value, color }) {
  return (
    <View style={styles.statItem}>
      <View style={[styles.statDot, { backgroundColor: color }]} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  filterTextActive: { color: Colors.primary },

  dayCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  dayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  dayDate: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800' },
  daySubtext: { color: Colors.textMuted, fontSize: FontSizes.xs },
  totalBadge: { alignItems: 'center', backgroundColor: Colors.primary + '15', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  totalCount: { color: Colors.primary, fontSize: FontSizes.xl, fontWeight: '900' },
  totalLabel: { color: Colors.primary, fontSize: FontSizes.xs, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statItem: { width: '50%', flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 6 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, flex: 1 },
  statValue: { fontSize: FontSizes.base, fontWeight: '700' },
});
