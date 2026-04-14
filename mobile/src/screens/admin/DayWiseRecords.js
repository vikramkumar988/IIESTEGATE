import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, EmptyState, LoadingScreen } from '../../components';
import DateRangePicker from '../../components/DateRangePicker';
import { dashboardService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const MODES = [
  { key: 'daywise', label: 'Day-Wise', icon: 'stats-chart' },
  { key: 'daterange', label: 'Date Range', icon: 'analytics' },
  { key: 'staffperf', label: 'Staff Metrics', icon: 'trophy' },
];

export default function DayWiseRecords({ navigation, route }) {
  const initialMode = route?.params?.showStaffPerf ? 'staffperf' : route?.params?.showDateRange ? 'daterange' : 'daywise';
  const [mode, setMode] = useState(initialMode);
  const [records, setRecords] = useState([]);
  const [generalRecords, setGeneralRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [days, setDays] = useState(30);

  // Date range report state
  const [dateRange, setDateRange] = useState({ date_from: getToday(), date_to: getToday() });
  const [dateRangeReport, setDateRangeReport] = useState(null);
  const [staffPerf, setStaffPerf] = useState([]);

  function getToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  const loadDayWise = useCallback(async () => {
    try {
      const res = await dashboardService.getDayWise({ days });
      setRecords(res.data?.data?.visit_requests || []);
      setGeneralRecords(res.data?.data?.general_visits || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [days]);

  const loadDateRangeReport = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dashboardService.getDateRangeReport(dateRange);
      setDateRangeReport(res.data?.data?.report || null);
    } catch (e) { console.log('Date range report error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [dateRange]);

  const loadStaffPerf = useCallback(async () => {
    try {
      setLoading(true);
      const res = await dashboardService.getStaffPerformance(dateRange);
      setStaffPerf(res.data?.data?.staff_performance || []);
    } catch (e) { console.log('Staff performance error:', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [dateRange]);

  useEffect(() => {
    if (mode === 'daywise') loadDayWise();
    else if (mode === 'daterange') loadDateRangeReport();
    else if (mode === 'staffperf') loadStaffPerf();
  }, [mode, loadDayWise, loadDateRangeReport, loadStaffPerf]);

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

  const formatMinutes = (min) => {
    if (!min && min !== 0) return '—';
    const m = parseFloat(min);
    if (m < 1) return '< 1m';
    if (m < 60) return `${Math.round(m)}m`;
    return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
  };

  const modeTitle = mode === 'daywise' ? 'Day-Wise Records' : mode === 'daterange' ? 'Date Range Analytics' : 'Staff Performance';

  if (loading && !refreshing) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title={modeTitle} showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {
          setRefreshing(true);
          if (mode === 'daywise') loadDayWise();
          else if (mode === 'daterange') loadDateRangeReport();
          else loadStaffPerf();
        }} tintColor={Colors.primary} />}>

        {/* Mode Toggle */}
        <View style={styles.modeRow}>
          {MODES.map((m) => (
            <TouchableOpacity key={m.key} style={[styles.modeBtn, mode === m.key && styles.modeBtnActive]}
              onPress={() => setMode(m.key)}>
              <Ionicons name={m.icon} size={16} color={mode === m.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.modeBtnText, mode === m.key && styles.modeBtnTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ===== DAY-WISE MODE ===== */}
        {mode === 'daywise' && (
          <>
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
          </>
        )}

        {/* ===== DATE RANGE REPORT MODE ===== */}
        {mode === 'daterange' && (
          <>
            <DateRangePicker
              initialPreset="last7"
              onDateChange={(range) => setDateRange(range)}
            />

            {dateRangeReport ? (
              <>
                {/* Summary Cards */}
                <View style={styles.reportGrid}>
                  <ReportCard label="Total Visits" value={dateRangeReport.total_professor_visits + dateRangeReport.total_general_visits} icon="people" color={Colors.primary} />
                  <ReportCard label="Unique Visitors" value={dateRangeReport.unique_visitors} icon="person" color="#a78bfa" />
                  <ReportCard label="Approved" value={dateRangeReport.total_approved} icon="checkmark-circle" color={Colors.success} />
                  <ReportCard label="Rejected" value={dateRangeReport.total_rejected} icon="close-circle" color={Colors.danger} />
                  <ReportCard label="Campus Entries" value={dateRangeReport.total_entries} icon="log-in" color="#3b82f6" />
                  <ReportCard label="Avg Duration" value={dateRangeReport.avg_visit_duration_min ? `${dateRangeReport.avg_visit_duration_min}m` : '—'} icon="time" color="#f59e0b" />
                </View>

                {/* Visit Type Distribution */}
                {dateRangeReport.type_distribution && (
                  <Card style={styles.reportSection}>
                    <Text style={styles.reportSectionTitle}>Visit Classification</Text>
                    <View style={styles.typeRow}>
                      <View style={styles.typePill}>
                        <Text style={styles.typeEmoji}>🚶</Text>
                        <Text style={styles.typeValue}>{dateRangeReport.type_distribution.walk_in || 0}</Text>
                        <Text style={styles.typeLabel}>Walk-in</Text>
                      </View>
                      <View style={styles.typePill}>
                        <Text style={styles.typeEmoji}>📋</Text>
                        <Text style={styles.typeValue}>{dateRangeReport.type_distribution.pre_registered || 0}</Text>
                        <Text style={styles.typeLabel}>Pre-Reg</Text>
                      </View>
                      <View style={styles.typePill}>
                        <Text style={styles.typeEmoji}>↩️</Text>
                        <Text style={styles.typeValue}>{dateRangeReport.type_distribution.referrals || 0}</Text>
                        <Text style={styles.typeLabel}>Referrals</Text>
                      </View>
                    </View>
                  </Card>
                )}

                {/* Peak Hours */}
                {dateRangeReport.peak_hours?.length > 0 && (
                  <Card style={styles.reportSection}>
                    <Text style={styles.reportSectionTitle}>Peak Hours</Text>
                    {dateRangeReport.peak_hours.map((ph, i) => (
                      <View key={i} style={styles.peakRow}>
                        <Text style={styles.peakHour}>{ph.hour}:00 - {ph.hour + 1}:00</Text>
                        <View style={[styles.peakBar, { width: `${Math.min(100, (ph.count / (dateRangeReport.peak_hours[0]?.count || 1)) * 100)}%` }]} />
                        <Text style={styles.peakCount}>{ph.count}</Text>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Top Staff */}
                {dateRangeReport.staff_breakdown?.length > 0 && (
                  <Card style={styles.reportSection}>
                    <Text style={styles.reportSectionTitle}>Staff Breakdown</Text>
                    {dateRangeReport.staff_breakdown.slice(0, 8).map((s, i) => (
                      <View key={i} style={styles.staffBreakdownRow}>
                        <Text style={styles.staffBreakdownRank}>#{i + 1}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.staffBreakdownName}>{s.full_name}</Text>
                          <Text style={styles.staffBreakdownDept}>{s.department || '—'}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.staffBreakdownTotal}>{s.total_requests}</Text>
                          <Text style={styles.staffBreakdownMeta}>{s.approved}✓ {s.rejected}✗</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}

                {/* Repeat Visitors */}
                {dateRangeReport.repeat_visitors?.length > 0 && (
                  <Card style={styles.reportSection}>
                    <Text style={styles.reportSectionTitle}>Repeat Visitors</Text>
                    {dateRangeReport.repeat_visitors.map((v, i) => (
                      <View key={i} style={styles.repeatRow}>
                        <View>
                          <Text style={styles.repeatName}>{v.full_name}</Text>
                          <Text style={styles.repeatPhone}>{v.phone}</Text>
                        </View>
                        <View style={styles.repeatBadge}>
                          <Text style={styles.repeatCount}>{v.visit_count}x</Text>
                        </View>
                      </View>
                    ))}
                  </Card>
                )}
              </>
            ) : (
              <EmptyState icon="analytics-outline" title="Select Date Range" message="Choose a date range above to generate a report" />
            )}
          </>
        )}

        {/* ===== STAFF PERFORMANCE MODE ===== */}
        {mode === 'staffperf' && (
          <>
            <DateRangePicker
              initialPreset="last30"
              onDateChange={(range) => setDateRange(range)}
            />

            {staffPerf.length === 0 ? (
              <EmptyState icon="trophy-outline" title="No data" message="No staff activity in this period" />
            ) : (
              staffPerf.map((s, i) => (
                <Card key={s.id || i} style={styles.perfCard}>
                  <View style={styles.perfHeader}>
                    <View style={styles.perfRankCircle}>
                      <Text style={styles.perfRank}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.perfName}>{s.full_name}</Text>
                      <Text style={styles.perfDept}>{s.department || s.designation || 'Staff'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.perfTotal}>{s.total_requests}</Text>
                      <Text style={styles.perfTotalLabel}>requests</Text>
                    </View>
                  </View>
                  <View style={styles.perfMetrics}>
                    <View style={styles.perfMetric}>
                      <Text style={[styles.perfMetricValue, { color: Colors.success }]}>{s.approved}</Text>
                      <Text style={styles.perfMetricLabel}>Approved</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfMetric}>
                      <Text style={[styles.perfMetricValue, { color: Colors.danger }]}>{s.rejected}</Text>
                      <Text style={styles.perfMetricLabel}>Rejected</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfMetric}>
                      <Text style={[styles.perfMetricValue, { color: '#a78bfa' }]}>{s.approval_rate || 0}%</Text>
                      <Text style={styles.perfMetricLabel}>Rate</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfMetric}>
                      <Text style={[styles.perfMetricValue, { color: '#f59e0b' }]}>{formatMinutes(s.avg_response_min)}</Text>
                      <Text style={styles.perfMetricLabel}>Avg Resp</Text>
                    </View>
                    <View style={styles.perfDivider} />
                    <View style={styles.perfMetric}>
                      <Text style={[styles.perfMetricValue, { color: Colors.primary }]}>{s.unique_visitors}</Text>
                      <Text style={styles.perfMetricLabel}>Visitors</Text>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </>
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

function ReportCard({ label, value, icon, color }) {
  return (
    <View style={[styles.reportCard, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.reportCardValue}>{value}</Text>
      <Text style={styles.reportCardLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  // Mode toggle
  modeRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  modeBtnActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  modeBtnText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  modeBtnTextActive: { color: Colors.primary },

  // Day-wise filters
  filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  filterChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  filterChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  filterTextActive: { color: Colors.primary },

  // Day card
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

  // Date range report
  reportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
  reportCard: { width: '47%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: 14, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3 },
  reportCardValue: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginTop: 6 },
  reportCardLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
  reportSection: { padding: Spacing.lg, marginBottom: Spacing.md },
  reportSectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },

  // Type distribution
  typeRow: { flexDirection: 'row', gap: 12 },
  typePill: { flex: 1, backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  typeEmoji: { fontSize: 20, marginBottom: 4 },
  typeValue: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900' },
  typeLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Peak hours
  peakRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  peakHour: { width: 100, color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  peakBar: { height: 8, backgroundColor: Colors.primary + '40', borderRadius: 4, marginRight: 8 },
  peakCount: { color: Colors.text, fontSize: 13, fontWeight: '800', minWidth: 30, textAlign: 'right' },

  // Staff breakdown
  staffBreakdownRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '50' },
  staffBreakdownRank: { color: Colors.textMuted, fontSize: 12, fontWeight: '800', width: 28 },
  staffBreakdownName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  staffBreakdownDept: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  staffBreakdownTotal: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800' },
  staffBreakdownMeta: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },

  // Repeat visitors
  repeatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '50' },
  repeatName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  repeatPhone: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  repeatBadge: { backgroundColor: Colors.warning + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  repeatCount: { color: Colors.warning, fontSize: 13, fontWeight: '800' },

  // Staff performance cards
  perfCard: { padding: Spacing.lg, marginBottom: Spacing.md },
  perfHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  perfRankCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  perfRank: { color: Colors.primary, fontSize: 13, fontWeight: '900' },
  perfName: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  perfDept: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  perfTotal: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900' },
  perfTotalLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600' },
  perfMetrics: { flexDirection: 'row', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: 10 },
  perfMetric: { flex: 1, alignItems: 'center' },
  perfMetricValue: { fontSize: FontSizes.md, fontWeight: '800' },
  perfMetricLabel: { fontSize: 9, color: Colors.textMuted, fontWeight: '600', marginTop: 2 },
  perfDivider: { width: 1, backgroundColor: Colors.border, marginVertical: 2 },
});
