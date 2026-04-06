import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, EmptyState, LoadingScreen } from '../../components';
import { dashboardService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const ACTION_ICONS = {
  create_visit_request: { icon: 'add-circle', color: Colors.primary },
  edit_visit_request: { icon: 'create', color: Colors.warning },
  re_raise_request: { icon: 'refresh-circle', color: Colors.secondary },
  approve_request: { icon: 'checkmark-circle', color: Colors.success },
  reject_request: { icon: 'close-circle', color: Colors.danger },
  cancel_request: { icon: 'ban', color: Colors.textMuted },
  public_registration: { icon: 'person-add', color: Colors.primary },
  approve_user: { icon: 'person-add', color: Colors.success },
  reject_user_registration: { icon: 'person-remove', color: Colors.danger },
  create_user_admin: { icon: 'person-add', color: Colors.primary },
  update_user: { icon: 'create', color: Colors.warning },
  deactivate_user: { icon: 'person-remove', color: Colors.danger },
};

const ACTION_LABELS = {
  create_visit_request: 'Created Visit Request',
  edit_visit_request: 'Edited Visit Request',
  re_raise_request: 'Re-raised Request',
  approve_request: 'Approved Request',
  reject_request: 'Rejected Request',
  cancel_request: 'Cancelled Request',
  public_registration: 'New Registration',
  approve_user: 'Approved User',
  reject_user_registration: 'Rejected Registration',
  create_user_admin: 'Created User (Admin)',
  update_user: 'Updated User',
  deactivate_user: 'Deactivated User',
};

export default function ActivityLogScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadData = useCallback(async (pageNum = 1, append = false) => {
    try {
      const res = await dashboardService.getActivityLogs({ page: pageNum, limit: 30 });
      const data = res.data?.data;
      const newLogs = data?.logs || [];
      setLogs(prev => append ? [...prev, ...newLogs] : newLogs);
      setHasMore(pageNum < (data?.pagination?.totalPages || 1));
      setPage(pageNum);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); setLoadingMore(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    loadData(page + 1, true);
  };

  const formatTime = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  };

  const getActionInfo = (action) => ACTION_ICONS[action] || { icon: 'ellipse', color: Colors.textMuted };

  const getDetailText = (log) => {
    const details = log.details || {};
    const parts = [];
    if (details.visitor_name) parts.push(`Visitor: ${details.visitor_name}`);
    if (details.staff_name) parts.push(`Staff: ${details.staff_name}`);
    if (details.purpose) parts.push(`Purpose: ${details.purpose}`);
    if (details.reason) parts.push(`Reason: ${details.reason}`);
    if (details.message) parts.push(`Message: ${details.message}`);
    if (details.approved_name) parts.push(`User: ${details.approved_name}`);
    if (details.rejected_name) parts.push(`User: ${details.rejected_name}`);
    if (details.role) parts.push(`Role: ${details.role}`);
    if (details.email) parts.push(`Email: ${details.email}`);
    return parts.join(' • ');
  };

  const renderItem = ({ item: log }) => {
    const actionInfo = getActionInfo(log.action);
    const detailText = getDetailText(log);
    return (
      <Card style={styles.logCard}>
        <View style={styles.logRow}>
          <View style={[styles.iconCircle, { backgroundColor: actionInfo.color + '15' }]}>
            <Ionicons name={actionInfo.icon} size={20} color={actionInfo.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.logAction}>{ACTION_LABELS[log.action] || log.action}</Text>
            {log.user_name && (
              <Text style={styles.logUser}>by {log.user_name} ({log.user_role})</Text>
            )}
            {detailText ? <Text style={styles.logDetail} numberOfLines={2}>{detailText}</Text> : null}
          </View>
          <Text style={styles.logTime}>{formatTime(log.created_at)}</Text>
        </View>
      </Card>
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Activity Log" showBack onBack={() => navigation.goBack()} />

      <FlatList
        data={logs}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(1); }} tintColor={Colors.primary} />}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={<EmptyState icon="document-text-outline" title="No activity yet" message="Actions will appear here as they happen" />}
        ListFooterComponent={loadingMore ? <Text style={styles.loadingMore}>Loading more...</Text> : null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  logCard: { padding: Spacing.md, marginBottom: Spacing.sm },
  logRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  logAction: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  logUser: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 1 },
  logDetail: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 3 },
  logTime: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },

  loadingMore: { color: Colors.textMuted, textAlign: 'center', padding: Spacing.md },
});
