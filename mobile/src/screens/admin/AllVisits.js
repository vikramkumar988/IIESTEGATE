import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Image, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, Header, EmptyState, LoadingScreen } from '../../components';
import { visitService, generalVisitService, getBaseUrl } from '../../services/api';
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
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'all', label: 'All Time' },
];
import { resolvePhotoUrl } from '../../utils/photoUrl';



export default function AllVisits({ navigation }) {
  const [visits, setVisits] = useState([]);
  const [generalVisits, setGeneralVisits] = useState([]);
  const [typeTab, setTypeTab] = useState('professor');
  const [statusTab, setStatusTab] = useState('all');
  const [dateFilter, setDateFilter] = useState('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params = { limit: 100 };
      if (statusTab !== 'all') params.status = statusTab;
      const [profRes, genRes] = await Promise.all([
        visitService.getAll(params),
        generalVisitService.getAll({ limit: 100 }),
      ]);
      setVisits(profRes.data?.data?.visits || []);
      setGeneralVisits(genRes.data?.data?.visits || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [statusTab]);

  useEffect(() => { setLoading(true); loadData(); }, [loadData]);

  const getStatusColor = (status) => {
    const map = { pending: 'warning', approved: 'success', rejected: 'danger', expired: 'expired', cancelled: 'cancelled', active: 'success', revoked: 'danger' };
    return map[status] || 'primary';
  };

  // Filter by date
  const filterByDate = (list) => {
    if (dateFilter === 'all') return list;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return list.filter(v => {
      const d = new Date(v.created_at);
      if (dateFilter === 'today') return d >= today;
      if (dateFilter === 'week') { const w = new Date(today); w.setDate(w.getDate() - 7); return d >= w; }
      if (dateFilter === 'month') { const m = new Date(today); m.setDate(m.getDate() - 30); return d >= m; }
      return true;
    });
  };

  if (loading) return <LoadingScreen />;

  const filteredProfessor = filterByDate(visits);
  const filteredGeneral = filterByDate(generalVisits);
  const currentList = typeTab === 'professor' ? filteredProfessor : filteredGeneral;

  // Summary counts for professor visits
  const profSummary = {
    total: filteredProfessor.length,
    approved: filteredProfessor.filter(v => v.status === 'approved').length,
    rejected: filteredProfessor.filter(v => v.status === 'rejected').length,
    pending: filteredProfessor.filter(v => v.status === 'pending').length,
  };

  const renderItem = ({ item: v, index }) => (
    <Card key={`${v.id}-${index}`} style={styles.card}
      onPress={() => typeTab === 'professor' ? navigation.navigate('VisitDetail', { visitId: v.id }) : null}>
      <View style={styles.visitRow}>
        {v.visitor_photo ? (
          <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Ionicons name="person" size={22} color={Colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{v.visitor_name}</Text>
            <Badge text={v.status} variant={getStatusColor(v.status)} size="sm" />
          </View>

          {/* Phone with quick dial */}
          <TouchableOpacity style={styles.phoneLine} onPress={() => Linking.openURL(`tel:${v.visitor_phone}`)}>
            <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
            <Text style={styles.meta}>{v.visitor_phone}</Text>
            <Ionicons name="call" size={12} color={Colors.primary} />
          </TouchableOpacity>

          <Text style={styles.meta}>📋 {v.purpose}{v.purpose_detail ? ` — ${v.purpose_detail}` : ''}</Text>
          
          {/* Staff info */}
          {v.staff_name && (
            <View style={styles.staffLine}>
              <Ionicons name="school" size={12} color="#a78bfa" />
              <Text style={[styles.meta, { color: '#a78bfa' }]}>{v.staff_name} {v.staff_department ? `(${v.staff_department})` : ''}</Text>
            </View>
          )}

          {/* Guard info */}
          {v.guard_name && (
            <View style={styles.staffLine}>
              <Ionicons name="shield" size={12} color={Colors.secondary} />
              <Text style={[styles.meta, { color: Colors.secondary }]}>{v.guard_name}</Text>
            </View>
          )}

          {/* Time */}
          <Text style={styles.time}>{new Date(v.created_at).toLocaleString('en-IN')}</Text>

          {/* Entry/Exit for approved/expired visits */}
          {['approved', 'expired', 'completed'].includes(v.status) && (v.entry_time || v.exit_time || v.pass_code) && (
            <View style={styles.entryExitRow}>
              {v.entry_time ? (
                <View style={[styles.entryPill, { borderColor: '#22c55e50', backgroundColor: '#22c55e08' }]}>
                  <Ionicons name="log-in" size={11} color="#22c55e" />
                  <Text style={[styles.entryPillText, { color: '#22c55e' }]}>In {new Date(v.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              ) : (
                <View style={styles.entryPill}>
                  <Text style={styles.entryPillText}>Not entered</Text>
                </View>
              )}
              {v.exit_time ? (
                <View style={[styles.entryPill, { borderColor: '#3b82f650', backgroundColor: '#3b82f608' }]}>
                  <Ionicons name="log-out" size={11} color="#3b82f6" />
                  <Text style={[styles.entryPillText, { color: '#3b82f6' }]}>Out {new Date(v.exit_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              ) : v.entry_time ? (
                <View style={[styles.entryPill, { borderColor: '#f59e0b50', backgroundColor: '#f59e0b08' }]}>
                  <Text style={[styles.entryPillText, { color: '#f59e0b' }]}>⏳ Still inside</Text>
                </View>
              ) : null}
            </View>
          )}

          {/* Approval/rejection messages */}
          {v.approval_message && (
            <View style={styles.msgBox}>
              <Text style={styles.msgLabel}>Staff message:</Text>
              <Text style={styles.msgText} numberOfLines={2}>{v.approval_message}</Text>
            </View>
          )}
          {v.reject_reason && <Text style={styles.rejectText}>❌ {v.reject_reason}</Text>}
        </View>
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <Header title="All Visits" showBack onBack={() => navigation.goBack()} />

      {/* Type Tabs */}
      <View style={styles.typeRow}>
        {TYPE_TABS.map((tab) => (
          <TouchableOpacity key={tab.key} style={[styles.typeTab, typeTab === tab.key && styles.typeTabActive]}
            onPress={() => setTypeTab(tab.key)}>
            <Ionicons name={tab.icon} size={16} color={typeTab === tab.key ? Colors.primary : Colors.textMuted} />
            <Text style={[styles.typeText, typeTab === tab.key && styles.typeTextActive]}>
              {tab.label} ({tab.key === 'professor' ? filteredProfessor.length : filteredGeneral.length})
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date Filter */}
      <View style={styles.dateFilterRow}>
        {DATE_FILTERS.map((df) => (
          <TouchableOpacity key={df.key} style={[styles.dateChip, dateFilter === df.key && styles.dateChipActive]}
            onPress={() => setDateFilter(df.key)}>
            <Text style={[styles.dateChipText, dateFilter === df.key && styles.dateChipTextActive]}>{df.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status Sub-tabs (only for professor) */}
      {typeTab === 'professor' && (
        <View style={styles.statusBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusScroll}>
            {STATUS_TABS.map((tab) => (
              <TouchableOpacity key={tab.key} style={[styles.statusChip, statusTab === tab.key && styles.statusChipActive]}
                onPress={() => setStatusTab(tab.key)}>
                <Text style={[styles.statusText, statusTab === tab.key && styles.statusTextActive]}>{tab.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Summary Row for Professor visits */}
      {typeTab === 'professor' && (
        <View style={styles.summaryRow}>
          <View style={[styles.summaryPill, { borderColor: Colors.primary }]}>
            <Text style={[styles.summaryNum, { color: Colors.primary }]}>{profSummary.total}</Text>
            <Text style={styles.summaryLabel}>Total</Text>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.success }]}>
            <Text style={[styles.summaryNum, { color: Colors.success }]}>{profSummary.approved}</Text>
            <Text style={styles.summaryLabel}>Approved</Text>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.danger }]}>
            <Text style={[styles.summaryNum, { color: Colors.danger }]}>{profSummary.rejected}</Text>
            <Text style={styles.summaryLabel}>Rejected</Text>
          </View>
          <View style={[styles.summaryPill, { borderColor: Colors.warning }]}>
            <Text style={[styles.summaryNum, { color: Colors.warning }]}>{profSummary.pending}</Text>
            <Text style={styles.summaryLabel}>Pending</Text>
          </View>
        </View>
      )}

      <FlatList
        data={currentList}
        keyExtractor={(item, index) => `visit-${item.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No visits" message="No visits found with the selected filters" />}
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

  typeRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  typeTab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  typeTabActive: { borderBottomColor: Colors.primary },
  typeText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  typeTextActive: { color: Colors.primary },

  // Date filter
  dateFilterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: 8 },
  dateChip: { flex: 1, paddingVertical: 7, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  dateChipActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  dateChipText: { fontSize: 11, color: Colors.textMuted, fontWeight: '700' },
  dateChipTextActive: { color: Colors.primary },

  // Summary row
  summaryRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm, gap: 6 },
  summaryPill: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1.5, backgroundColor: Colors.surface },
  summaryNum: { fontSize: FontSizes.lg, fontWeight: '900' },
  summaryLabel: { fontSize: 8, color: Colors.textMuted, fontWeight: '700', textTransform: 'uppercase', marginTop: 1 },

  statusBar: { backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  statusScroll: { paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.xs },
  statusChip: { paddingHorizontal: Spacing.base, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: Colors.surfaceLight },
  statusChipActive: { backgroundColor: Colors.primary + '20' },
  statusText: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },
  statusTextActive: { color: Colors.primary },

  card: { padding: Spacing.base, marginBottom: Spacing.sm },
  visitRow: { flexDirection: 'row' },
  photo: { width: 52, height: 66, borderRadius: BorderRadius.sm },
  photoPlaceholder: { width: 52, height: 66, borderRadius: BorderRadius.sm, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  nameRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', flex: 1, marginRight: Spacing.sm },
  phoneLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  staffLine: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  time: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 4 },

  // Entry/Exit timeline
  entryExitRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  entryPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surfaceLight },
  entryPillText: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },

  rejectText: { color: Colors.danger, fontSize: FontSizes.sm, fontStyle: 'italic', marginTop: 4 },
  msgBox: { marginTop: 4, paddingLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: Colors.success },
  msgLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },
  msgText: { color: Colors.textSecondary, fontSize: FontSizes.sm },
});
