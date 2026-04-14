import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, Image, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard, Header, LoadingScreen, Badge, Button, Avatar } from '../../components';
import { dashboardService, notificationService, userService, visitService, gatePassService, getBaseUrl, getPreRegUrl, incidentService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export default function AdminDashboard({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [guardActivity, setGuardActivity] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lockdown, setLockdown] = useState(null);
  const [stillInside, setStillInside] = useState({ count: 0, visitors: [] });
  const [lockdownModalVisible, setLockdownModalVisible] = useState(false);
  const [lockdownReason, setLockdownReason] = useState('');
  const [broadcastModalVisible, setBroadcastModalVisible] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [openIncidents, setOpenIncidents] = useState(0);

  // Visitor detail modal
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, guardRes, notifRes, lockdownRes, insideRes, incidentRes] = await Promise.all([
        dashboardService.getStats().catch(() => ({ data: { data: { stats: {} } } })),
        dashboardService.getGuardActivity().catch(() => ({ data: { data: { guards: [] } } })),
        notificationService.getUnreadCount().catch(() => ({ data: { data: { count: 0 } } })),
        dashboardService.getLockdownStatus().catch(() => ({ data: { data: { is_lockdown: false } } })),
        userService.getStillInside().catch(() => ({ data: { data: { count: 0, visitors: [] } } })),
        incidentService.getAll({ resolved: 'false', limit: 1 }).catch(() => ({ data: { data: { pagination: { total: 0 } } } })),
      ]);

      setStats(statsRes.data?.data?.stats || {});
      setGuardActivity(guardRes.data?.data?.guards || []);
      setUnreadCount(notifRes.data?.data?.count || 0);
      setLockdown(lockdownRes.data?.data?.is_lockdown ? lockdownRes.data.data.lockdown : null);
      setStillInside(insideRes.data?.data || { count: 0, visitors: [] });
      setOpenIncidents(incidentRes.data?.data?.pagination?.total || 0);
    } catch (e) {
      console.log('Admin Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Lockdown
  const handleActivateLockdown = async () => {
    if (!lockdownReason.trim()) return Alert.alert('Required', 'Please provide a reason');
    try {
      await dashboardService.activateLockdown({ reason: lockdownReason.trim() });
      Alert.alert('🚨 Lockdown Active', 'All passes revoked. All personnel notified.');
      setLockdownModalVisible(false);
      setLockdownReason('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to activate lockdown');
    }
  };

  const handleLiftLockdown = () => {
    Alert.alert('Lift Lockdown?', 'This will allow normal operations to resume.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lift', onPress: async () => {
          try {
            await dashboardService.liftLockdown();
            Alert.alert('✅ Lockdown Lifted', 'Normal operations resumed.');
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed to lift lockdown'); }
        }
      },
    ]);
  };

  // Broadcast
  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return Alert.alert('Required', 'Message is required');
    setBroadcastSending(true);
    try {
      const res = await dashboardService.broadcastAlert({ title: broadcastTitle.trim() || undefined, message: broadcastMsg.trim() });
      Alert.alert('📢 Sent', res.data?.message || 'Alert sent to all guards.');
      setBroadcastModalVisible(false);
      setBroadcastMsg('');
      setBroadcastTitle('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send broadcast');
    } finally {
      setBroadcastSending(false);
    }
  };

  // Force exit
  const handleForceExit = (passId, name) => {
    Alert.alert('Force Exit?', `Record exit for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Force Exit', style: 'destructive', onPress: async () => {
          try {
            await userService.forceExit({ pass_id: passId });
            Alert.alert('Done', `Exit recorded for ${name}`);
            setShowVisitorModal(false);
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed to record exit'); }
        }
      },
    ]);
  };

  const getTimeInside = (entryTime) => {
    const ms = Date.now() - new Date(entryTime).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) return <LoadingScreen />;

  const s = stats || {};

  return (
    <View style={styles.container}>
      {/* ══════════ HEADER ══════════ */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.roleBadge}>ADMIN</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {unreadCount > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 🚨 LOCKDOWN */}
      {lockdown && (
        <TouchableOpacity style={styles.lockdownBanner} onPress={handleLiftLockdown}>
          <Ionicons name="lock-closed" size={20} color="#FF3333" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
            <Text style={styles.lockdownReason}>{lockdown.reason} • Tap to lift</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#FF6666" />
        </TouchableOpacity>
      )}

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        {/* ══════════ ANALYTICS CARDS ══════════ */}
        <View style={styles.analyticsRow}>
          <View style={[styles.analyticsCard, { borderLeftColor: Colors.primary }]}>
            <Text style={styles.analyticsValue}>{s.visits_this_month || 0}</Text>
            <Text style={styles.analyticsLabel}>Visits This Month</Text>
            <View style={styles.trendPill}>
              <Ionicons name="trending-up" size={10} color={Colors.success} />
              <Text style={styles.trendText}>+{s.visits_this_week || 0} this week</Text>
            </View>
          </View>
          <View style={[styles.analyticsCard, { borderLeftColor: Colors.success }]}>
            <Text style={styles.analyticsValue}>{s.active_passes || 0}</Text>
            <Text style={styles.analyticsLabel}>Active Passes</Text>
            <View style={[styles.trendPill, { backgroundColor: '#22c55e10' }]}>
              <View style={styles.activeDot} />
              <Text style={[styles.trendText, { color: '#22c55e' }]}>Live</Text>
            </View>
          </View>
        </View>

        <View style={styles.analyticsRow}>
          <View style={[styles.analyticsCard, { borderLeftColor: Colors.warning }]}>
            <Text style={styles.analyticsValue}>{s.pending_requests || 0}</Text>
            <Text style={styles.analyticsLabel}>Pending Requests</Text>
          </View>
          <View style={[styles.analyticsCard, { borderLeftColor: openIncidents > 0 ? '#ef4444' : Colors.textMuted }]}>
            <Text style={[styles.analyticsValue, openIncidents > 0 && { color: '#ef4444' }]}>{openIncidents}</Text>
            <Text style={styles.analyticsLabel}>Open Incidents</Text>
            {openIncidents > 0 && (
              <View style={[styles.trendPill, { backgroundColor: '#ef444410' }]}>
                <Ionicons name="alert-circle" size={10} color="#ef4444" />
                <Text style={[styles.trendText, { color: '#ef4444' }]}>Needs attention</Text>
              </View>
            )}
          </View>
        </View>

        {/* ══════════ TODAY'S SUMMARY ══════════ */}
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Ionicons name="analytics" size={18} color={Colors.primary} />
            <Text style={styles.todayTitle}>Today's Overview</Text>
          </View>
          <View style={styles.todayRow}>
            <View style={styles.todayItem}>
              <Text style={[styles.todayValue, { color: Colors.primary }]}>{s.visits_today || 0}</Text>
              <Text style={styles.todayLabel}>Total Visits</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayItem}>
              <Text style={[styles.todayValue, { color: '#a78bfa' }]}>{s.professor_visits_today || 0}</Text>
              <Text style={styles.todayLabel}>Professor</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayItem}>
              <Text style={[styles.todayValue, { color: Colors.success }]}>{s.general_visits_today || 0}</Text>
              <Text style={styles.todayLabel}>General</Text>
            </View>
            <View style={styles.todayDivider} />
            <View style={styles.todayItem}>
              <Text style={[styles.todayValue, { color: '#22c55e' }]}>{stillInside.count || 0}</Text>
              <Text style={styles.todayLabel}>Inside Now</Text>
            </View>
          </View>
        </View>

        {/* ══════════ QUICK ACTIONS ══════════ */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.quickActionsGrid}>
          <TouchableOpacity style={styles.qaBtn} onPress={() => setBroadcastModalVisible(true)}>
            <View style={[styles.qaIcon, { backgroundColor: '#3b82f612' }]}>
              <Ionicons name="megaphone" size={22} color="#3b82f6" />
            </View>
            <Text style={styles.qaLabel}>Broadcast{'\n'}Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={() => lockdown ? handleLiftLockdown() : setLockdownModalVisible(true)}>
            <View style={[styles.qaIcon, { backgroundColor: lockdown ? '#22c55e12' : '#ef444412' }]}>
              <Ionicons name={lockdown ? 'lock-open' : 'lock-closed'} size={22} color={lockdown ? '#22c55e' : '#ef4444'} />
            </View>
            <Text style={styles.qaLabel}>{lockdown ? 'Lift' : 'Activate'}{'\n'}Lockdown</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={() => navigation.navigate('IncidentList')}>
            <View style={[styles.qaIcon, { backgroundColor: '#f9731612' }]}>
              <Ionicons name="warning" size={22} color="#f97316" />
              {openIncidents > 0 && <View style={styles.qaBadge}><Text style={styles.qaBadgeText}>{openIncidents}</Text></View>}
            </View>
            <Text style={styles.qaLabel}>View{'\n'}Incidents</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={() => navigation.navigate('EmergencyContacts')}>
            <View style={[styles.qaIcon, { backgroundColor: '#ef444412' }]}>
              <Ionicons name="call" size={22} color="#ef4444" />
            </View>
            <Text style={styles.qaLabel}>Emergency{'\n'}Contacts</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════ MANAGEMENT CONSOLE ══════════ */}
        <Text style={styles.sectionLabel}>MANAGEMENT CONSOLE</Text>
        <View style={styles.mgmtGrid}>
          {[
            { icon: 'people', label: 'User Management', color: Colors.primary, screen: 'UserManagement', badge: s.pending_users },
            { icon: 'list', label: 'All Visits', color: '#a78bfa', screen: 'AllVisits' },
            { icon: 'bar-chart', label: 'Analytics', color: Colors.success, screen: 'ActivityLog' },
            { icon: 'ban', label: 'Blacklist', color: '#ef4444', screen: 'BlacklistManagement' },
            { icon: 'person-add', label: 'Pending Users', color: Colors.warning, screen: 'PendingUsers', badge: s.pending_users },
            { icon: 'document-text', label: 'Activity Logs', color: '#64748b', screen: 'ActivityLog' },
          ].map((item, idx) => (
            <TouchableOpacity key={`mgmt-${idx}`} style={styles.mgmtCard} onPress={() => navigation.navigate(item.screen)}>
              <View style={[styles.mgmtIcon, { backgroundColor: item.color + '12' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
                {item.badge > 0 && (
                  <View style={styles.mgmtBadge}>
                    <Text style={styles.mgmtBadgeText}>{item.badge}</Text>
                  </View>
                )}
              </View>
              <Text style={styles.mgmtLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════ GUARD ACTIVITY ══════════ */}
        {guardActivity.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="shield" size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Guard Activity (24h)</Text>
            </View>
            {guardActivity.slice(0, 5).map((guard, idx) => (
              <View key={`guard-${guard.id}-${idx}`} style={styles.guardRow}>
                <View style={styles.guardAvatar}>
                  <Text style={styles.guardAvatarText}>{guard.full_name?.charAt(0)?.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.guardName}>{guard.full_name}</Text>
                  <Text style={styles.guardGate}>{guard.gate_assigned || 'Unassigned'}</Text>
                </View>
                <View style={styles.guardStats}>
                  <Text style={styles.guardStatValue}>{guard.requests_today}</Text>
                  <Text style={styles.guardStatLabel}>Req</Text>
                </View>
                <View style={styles.guardStats}>
                  <Text style={styles.guardStatValue}>{guard.passes_today}</Text>
                  <Text style={styles.guardStatLabel}>Pass</Text>
                </View>
                <View style={styles.guardStats}>
                  <Text style={styles.guardStatValue}>{guard.scans_today}</Text>
                  <Text style={styles.guardStatLabel}>Scan</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ══════════ VISITORS INSIDE ══════════ */}
        {stillInside.count > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={16} color="#22c55e" />
              <Text style={styles.sectionTitle}>Visitors Inside ({stillInside.count})</Text>
              <View style={styles.livePulse}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            {(stillInside.visitors || []).slice(0, 5).map((v, idx) => (
              <TouchableOpacity key={`inside-${v.pass_id}-${idx}`} style={styles.insideRow} onPress={() => { setSelectedVisitor(v); setShowVisitorModal(true); }}>
                {v.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.insideAvatar} />
                ) : (
                  <View style={styles.insideAvatarPlaceholder}>
                    <Text style={styles.insideAvatarLetter}>{v.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.insideName}>{v.visitor_name}</Text>
                  <Text style={styles.insideMeta}>{v.visit_type === 'professor_visit' ? `🎓 ${v.staff_name}` : '👥 General'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.insideTime}>{getTimeInside(v.entry_time)}</Text>
                  {new Date(v.valid_until) < new Date() && (
                    <Text style={styles.overstayText}>⚠️ Overstay</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════════ SYSTEM INFO ══════════ */}
        <View style={styles.systemInfo}>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Total Users</Text>
            <Text style={styles.systemValue}>{s.total_users || 0}</Text>
          </View>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Guards</Text>
            <Text style={styles.systemValue}>{s.total_guards || 0}</Text>
          </View>
          <View style={styles.systemRow}>
            <Text style={styles.systemLabel}>Staff</Text>
            <Text style={styles.systemValue}>{s.total_staff || 0}</Text>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════ LOCKDOWN MODAL ══════════ */}
      <Modal visible={lockdownModalVisible} transparent animationType="fade" onRequestClose={() => setLockdownModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.lockModalContainer}>
            <View style={styles.lockModalIcon}>
              <Ionicons name="lock-closed" size={40} color="#ef4444" />
            </View>
            <Text style={styles.lockModalTitle}>🚨 Activate Campus Lockdown</Text>
            <Text style={styles.lockModalSub}>This will revoke ALL active passes and notify all personnel. This is irreversible until manually lifted.</Text>
            <TextInput style={styles.lockModalInput} placeholder="Reason for lockdown..." placeholderTextColor={Colors.textMuted} value={lockdownReason} onChangeText={setLockdownReason} multiline />
            <View style={styles.lockModalActions}>
              <TouchableOpacity style={styles.lockCancelBtn} onPress={() => setLockdownModalVisible(false)}>
                <Text style={styles.lockCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lockConfirmBtn} onPress={handleActivateLockdown}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={styles.lockConfirmText}>ACTIVATE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════ BROADCAST MODAL ══════════ */}
      <Modal visible={broadcastModalVisible} transparent animationType="fade" onRequestClose={() => setBroadcastModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.broadcastContainer}>
            <View style={styles.broadcastIcon}>
              <Ionicons name="megaphone" size={36} color="#3b82f6" />
            </View>
            <Text style={styles.broadcastTitle}>📢 Broadcast to All Guards</Text>
            <Text style={styles.broadcastSub}>Send an alert message to every active guard on duty.</Text>
            <TextInput style={styles.broadcastInput} placeholder="Alert title (optional)" placeholderTextColor={Colors.textMuted} value={broadcastTitle} onChangeText={setBroadcastTitle} />
            <TextInput style={[styles.broadcastInput, { minHeight: 80 }]} placeholder="Message *" placeholderTextColor={Colors.textMuted} value={broadcastMsg} onChangeText={setBroadcastMsg} multiline textAlignVertical="top" />
            <View style={styles.lockModalActions}>
              <TouchableOpacity style={styles.lockCancelBtn} onPress={() => setBroadcastModalVisible(false)}>
                <Text style={styles.lockCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.lockConfirmBtn, { backgroundColor: '#3b82f6' }]} onPress={handleBroadcast} disabled={broadcastSending}>
                <Ionicons name="send" size={14} color="#fff" />
                <Text style={styles.lockConfirmText}>{broadcastSending ? 'Sending...' : 'SEND'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════ VISITOR DETAIL MODAL ══════════ */}
      <Modal visible={showVisitorModal} transparent animationType="slide" onRequestClose={() => setShowVisitorModal(false)}>
        <View style={styles.vModalOverlay}>
          <View style={styles.vModalContainer}>
            <TouchableOpacity style={styles.vModalClose} onPress={() => setShowVisitorModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            {selectedVisitor && (
              <ScrollView contentContainerStyle={styles.vModalContent}>
                <View style={styles.vModalHeader}>
                  {selectedVisitor.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(selectedVisitor.visitor_photo) }} style={styles.vModalAvatar} />
                  ) : (
                    <View style={styles.vModalAvatarPlaceholder}>
                      <Ionicons name="person" size={40} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.vModalName}>{selectedVisitor.visitor_name}</Text>
                  <Text style={styles.vModalPhone}>{selectedVisitor.visitor_phone}</Text>
                </View>
                <View style={styles.vModalStatusRow}>
                  <View style={[styles.vModalStatusCard, { borderColor: '#22c55e40' }]}>
                    <Text style={[styles.vModalStatusLabel, { color: '#22c55e' }]}>Entered</Text>
                    <Text style={styles.vModalStatusVal}>{new Date(selectedVisitor.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={[styles.vModalStatusCard, { borderColor: '#3b82f640' }]}>
                    <Text style={[styles.vModalStatusLabel, { color: '#3b82f6' }]}>Duration</Text>
                    <Text style={styles.vModalStatusVal}>{getTimeInside(selectedVisitor.entry_time)}</Text>
                  </View>
                </View>
                <View style={styles.vModalActions}>
                  <TouchableOpacity style={[styles.vModalActionBtn, { backgroundColor: '#ef444410', borderColor: '#ef444430' }]} onPress={() => handleForceExit(selectedVisitor.pass_id, selectedVisitor.visitor_name)}>
                    <Ionicons name="log-out" size={18} color="#ef4444" />
                    <Text style={[styles.vModalActionText, { color: '#ef4444' }]}>Force Exit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.vModalActionBtn, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary + '30' }]} onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={18} color={Colors.primary} />
                    <Text style={[styles.vModalActionText, { color: Colors.primary }]}>Call</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 60 },

  // Header
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.base },
  greeting: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },
  userName: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginTop: 2 },
  roleBadge: { color: Colors.primary, fontSize: 10, fontWeight: '800', marginTop: 4, letterSpacing: 2 },
  headerRight: { alignItems: 'flex-end' },
  notifBtn: { padding: 10, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  notifBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Lockdown
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF333318', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: 13, fontWeight: '900' },
  lockdownReason: { color: '#FF6666', fontSize: 11, marginTop: 2 },

  // Analytics cards
  analyticsRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  analyticsCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, borderLeftWidth: 3, borderWidth: 1, borderColor: Colors.border },
  analyticsValue: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900' },
  analyticsLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 4 },
  trendPill: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: Colors.primary + '10', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  trendText: { color: Colors.primary, fontSize: 9, fontWeight: '700' },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },

  // Today's overview
  todayCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  todayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  todayTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  todayRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  todayItem: { alignItems: 'center', flex: 1 },
  todayValue: { fontSize: FontSizes.xl, fontWeight: '900' },
  todayLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  todayDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  // Section label
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: 4 },

  // Quick actions
  quickActionsGrid: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  qaBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  qaIcon: { width: 46, height: 46, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6, position: 'relative' },
  qaLabel: { color: Colors.text, fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },
  qaBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  qaBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Management grid
  mgmtGrid: { marginBottom: Spacing.lg },
  mgmtCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 8, borderWidth: 1, borderColor: Colors.border, gap: 12 },
  mgmtIcon: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  mgmtLabel: { flex: 1, color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  mgmtBadge: { position: 'absolute', top: -4, right: -4, backgroundColor: Colors.warning, borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  mgmtBadgeText: { color: '#fff', fontSize: 8, fontWeight: '800' },

  // Section (guard activity, visitors inside)
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800', flex: 1 },
  livePulse: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontSize: 9, color: '#22c55e', fontWeight: '900', letterSpacing: 1 },

  // Guard rows
  guardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50', gap: 10 },
  guardAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  guardAvatarText: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  guardName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  guardGate: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  guardStats: { alignItems: 'center', minWidth: 32 },
  guardStatValue: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  guardStatLabel: { color: Colors.textMuted, fontSize: 8, fontWeight: '700' },

  // Inside campus
  insideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50' },
  insideAvatar: { width: 34, height: 34, borderRadius: 17 },
  insideAvatarPlaceholder: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  insideAvatarLetter: { color: Colors.primary, fontSize: 14, fontWeight: '800' },
  insideName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  insideMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  insideTime: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700' },
  overstayText: { color: '#f59e0b', fontSize: 9, fontWeight: '700', marginTop: 2 },

  // System info
  systemInfo: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  systemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.border + '50' },
  systemLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  systemValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  lockModalContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl, padding: Spacing.xl, width: '100%', maxWidth: 380, borderWidth: 2, borderColor: '#ef444440', alignItems: 'center' },
  lockModalIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef444415', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  lockModalTitle: { color: '#ef4444', fontSize: FontSizes.lg, fontWeight: '900', textAlign: 'center' },
  lockModalSub: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', marginTop: 6, marginBottom: 20, lineHeight: 18 },
  lockModalInput: { width: '100%', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 60, textAlignVertical: 'top' },
  lockModalActions: { flexDirection: 'row', marginTop: Spacing.lg, gap: 12, width: '100%' },
  lockCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  lockCancelText: { color: Colors.textSecondary, fontWeight: '700' },
  lockConfirmBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: '#ef4444' },
  lockConfirmText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  // Broadcast modal
  broadcastContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl, padding: Spacing.xl, width: '100%', maxWidth: 380, borderWidth: 2, borderColor: '#3b82f640', alignItems: 'center' },
  broadcastIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#3b82f615', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  broadcastTitle: { color: '#3b82f6', fontSize: FontSizes.lg, fontWeight: '900' },
  broadcastSub: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', marginTop: 4, marginBottom: 16 },
  broadcastInput: { width: '100%', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, marginBottom: 10 },

  // Visitor modal
  vModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  vModalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '75%', paddingTop: 16 },
  vModalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  vModalContent: { padding: Spacing.xl, paddingBottom: 40 },
  vModalHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  vModalAvatar: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#22c55e40' },
  vModalAvatarPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.border },
  vModalName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginTop: 12 },
  vModalPhone: { color: Colors.primary, fontSize: FontSizes.base, fontWeight: '700', marginTop: 4 },
  vModalStatusRow: { flexDirection: 'row', gap: 10, marginBottom: Spacing.lg },
  vModalStatusCard: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1, backgroundColor: Colors.surface },
  vModalStatusLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  vModalStatusVal: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', marginTop: 4 },
  vModalActions: { flexDirection: 'row', gap: 12 },
  vModalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1 },
  vModalActionText: { fontSize: FontSizes.sm, fontWeight: '800' },
});
