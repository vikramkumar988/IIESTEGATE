import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, EmptyState, LoadingScreen, Button } from '../../components';
import { notificationService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await notificationService.getAll({ limit: 50 });
      setNotifications(res.data?.data?.notifications || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const markAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (e) { console.log(e); }
  };

  const markRead = async (id) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (e) { console.log(e); }
  };

  const getIcon = (type) => {
    const map = { visit_request: 'person-add', approval: 'checkmark-circle', rejection: 'close-circle' };
    return map[type] || 'notifications';
  };

  const getIconColor = (type) => {
    const map = { visit_request: Colors.secondary, approval: Colors.success, rejection: Colors.danger };
    return map[type] || Colors.primary;
  };

  const formatTime = (date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString('en-IN');
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Notifications" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />

      {notifications.some(n => !n.is_read) && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Text style={styles.markAllText}>Mark all as read</Text>
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
        {notifications.length === 0 ? (
          <EmptyState icon="notifications-off-outline" title="No notifications" message="You're all caught up!" />
        ) : (
          notifications.map((n) => (
            <TouchableOpacity key={n.id} style={[styles.notifCard, !n.is_read && styles.unread]} onPress={() => markRead(n.id)} activeOpacity={0.7}>
              <View style={[styles.iconCircle, { backgroundColor: getIconColor(n.type) + '15' }]}>
                <Ionicons name={getIcon(n.type)} size={22} color={getIconColor(n.type)} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={[styles.notifTitle, !n.is_read && { color: Colors.text }]}>{n.title}</Text>
                <Text style={styles.notifBody} numberOfLines={2}>{n.body}</Text>
                <Text style={styles.notifTime}>{formatTime(n.created_at)}</Text>
              </View>
              {!n.is_read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  markAllBtn: { alignSelf: 'flex-end', paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm },
  markAllText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },

  notifCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md, padding: Spacing.base, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  unread: { backgroundColor: Colors.primary + '08', borderColor: Colors.primary + '30' },
  iconCircle: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  notifTitle: { color: Colors.textSecondary, fontSize: FontSizes.base, fontWeight: '700' },
  notifBody: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },
  notifTime: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 4 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
});
