import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { incidentService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const CATEGORY_META = {
  unauthorized_entry: { icon: 'ban', color: '#ef4444', label: 'Unauthorized Entry' },
  suspicious_activity: { icon: 'eye', color: '#f59e0b', label: 'Suspicious Activity' },
  theft: { icon: 'bag-remove', color: '#8b5cf6', label: 'Theft / Loss' },
  fight: { icon: 'flash', color: '#ec4899', label: 'Fight' },
  medical: { icon: 'medkit', color: '#22c55e', label: 'Medical' },
  fire: { icon: 'flame', color: '#f97316', label: 'Fire / Hazard' },
  vandalism: { icon: 'hammer', color: '#06b6d4', label: 'Vandalism' },
  other: { icon: 'alert-circle', color: '#64748b', label: 'Other' },
};

const SEVERITY_COLORS = { low: '#22c55e', medium: '#f59e0b', high: '#f97316', critical: '#ef4444' };

export default function IncidentListScreen({ navigation }) {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // all, open, resolved

  const loadData = useCallback(async () => {
    try {
      const params = { limit: 50 };
      if (filter === 'open') params.resolved = 'false';
      if (filter === 'resolved') params.resolved = 'true';
      const res = await incidentService.getAll(params);
      setIncidents(res.data?.data?.incidents || []);
    } catch (e) {
      console.log('Incidents load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  const handleResolve = (incident) => {
    Alert.alert('Resolve Incident?', `Mark "${incident.category}" incident as resolved?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Resolve', onPress: async () => {
          try {
            await incidentService.resolve(incident.id, { notes: 'Resolved by admin' });
            Alert.alert('✅ Resolved', 'Incident has been marked as resolved.');
            loadData();
          } catch (e) {
            Alert.alert('Error', e.response?.data?.message || 'Failed to resolve');
          }
        }
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  const FILTERS = [
    { key: 'all', label: 'All' },
    { key: 'open', label: 'Open' },
    { key: 'resolved', label: 'Resolved' },
  ];

  return (
    <View style={styles.container}>
      <Header title="Incidents" subtitle={`${incidents.length} reports`} showBack onBack={() => navigation.goBack()} />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterTab, filter === f.key && styles.filterTabActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
      >
        {incidents.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No Incidents" message="No incident reports found." />
        ) : (
          incidents.map((incident, idx) => {
            const meta = CATEGORY_META[incident.category] || CATEGORY_META.other;
            const sevColor = SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.medium;
            return (
              <View key={`inc-${incident.id}-${idx}`} style={styles.incidentCard}>
                <View style={styles.incidentHeader}>
                  <View style={[styles.catIconWrap, { backgroundColor: meta.color + '15' }]}>
                    <Ionicons name={meta.icon} size={20} color={meta.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.incidentTitle}>{meta.label}</Text>
                    <Text style={styles.incidentReporter}>
                      {incident.reporter_name} • {incident.reporter_role}{incident.gate_assigned ? ` (${incident.gate_assigned})` : ''}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Badge text={incident.is_resolved ? 'Resolved' : 'Open'} variant={incident.is_resolved ? 'success' : 'danger'} size="sm" />
                    <View style={[styles.severityPill, { backgroundColor: sevColor + '15', borderColor: sevColor + '40' }]}>
                      <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
                      <Text style={[styles.sevText, { color: sevColor }]}>{incident.severity}</Text>
                    </View>
                  </View>
                </View>

                <Text style={styles.incidentDesc} numberOfLines={3}>{incident.description}</Text>

                {incident.location && (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={Colors.textMuted} />
                    <Text style={styles.locationText}>{incident.location}</Text>
                  </View>
                )}

                <View style={styles.incidentFooter}>
                  <Text style={styles.timeText}>
                    {new Date(incident.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(incident.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {!incident.is_resolved && (
                    <TouchableOpacity style={styles.resolveBtn} onPress={() => handleResolve(incident)}>
                      <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
                      <Text style={styles.resolveText}>Resolve</Text>
                    </TouchableOpacity>
                  )}
                  {incident.is_resolved && incident.resolver_name && (
                    <Text style={styles.resolvedBy}>✅ {incident.resolver_name}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: 8 },
  filterTab: { flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  filterTabActive: { backgroundColor: Colors.primary + '15', borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  filterTextActive: { color: Colors.primary },
  incidentCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: 12, borderWidth: 1, borderColor: Colors.border },
  incidentHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: Spacing.sm },
  catIconWrap: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  incidentTitle: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  incidentReporter: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  severityPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1, marginTop: 6 },
  sevDot: { width: 6, height: 6, borderRadius: 3 },
  sevText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  incidentDesc: { color: Colors.textSecondary, fontSize: FontSizes.sm, lineHeight: 18, marginBottom: Spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: Spacing.sm },
  locationText: { color: Colors.textMuted, fontSize: 11 },
  incidentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  timeText: { color: Colors.textMuted, fontSize: 10, fontWeight: '600' },
  resolveBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.md, backgroundColor: Colors.success + '12', borderWidth: 1, borderColor: Colors.success + '30' },
  resolveText: { color: Colors.success, fontSize: 11, fontWeight: '700' },
  resolvedBy: { color: Colors.textMuted, fontSize: 10 },
});
