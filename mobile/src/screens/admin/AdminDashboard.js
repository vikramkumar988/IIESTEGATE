import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert, Modal, TextInput, Image, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard, Header, LoadingScreen, Badge, Button, Avatar } from '../../components';
import { dashboardService, notificationService, userService, visitService, gatePassService, getBaseUrl, getPreRegUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  // Visitor detail modal
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [statsRes, guardRes, notifRes, lockdownRes, insideRes] = await Promise.all([
        dashboardService.getStats().catch(() => ({ data: { data: { stats: {} } } })),
        dashboardService.getGuardActivity().catch(() => ({ data: { data: { guards: [] } } })),
        notificationService.getUnreadCount().catch(() => ({ data: { data: { count: 0 } } })),
        dashboardService.getLockdownStatus().catch(() => ({ data: { data: { is_lockdown: false } } })),
        userService.getStillInside().catch(() => ({ data: { data: { count: 0, visitors: [] } } })),
      ]);

      setStats(statsRes.data?.data?.stats || {});
      setGuardActivity(guardRes.data?.data?.guards || []);
      setUnreadCount(notifRes.data?.data?.count || 0);
      setLockdown(lockdownRes.data?.data?.is_lockdown ? lockdownRes.data.data.lockdown : null);
      setStillInside(insideRes.data?.data || { count: 0, visitors: [] });

    } catch (e) {
      console.log('Admin Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleActivateLockdown = async () => {
    if (!lockdownReason.trim()) return Alert.alert('Error', 'Provide a reason');
    try {
      await dashboardService.activateLockdown({ reason: lockdownReason.trim() });
      Alert.alert('🚨 Lockdown Activated', 'All passes revoked. All guards notified.');
      setLockdownModalVisible(false);
      setLockdownReason('');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed');
    }
  };

  const handleLiftLockdown = () => {
    Alert.alert('Lift Lockdown?', 'This will resume normal campus operations.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Lift', style: 'destructive', onPress: async () => {
          try {
            await dashboardService.liftLockdown();
            Alert.alert('✅ Lockdown Lifted', 'Normal operations resumed.');
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed to lift lockdown'); }
        },
      },
    ]);
  };

  const handleForceExit = async (passId, name) => {
    Alert.alert('Force Exit?', `Record exit for ${name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Force Exit', style: 'destructive', onPress: async () => {
          try {
            await userService.forceExit({ pass_id: passId });
            Alert.alert('Done', `Exit recorded for ${name}`);
            setShowVisitorModal(false);
            loadData();
          } catch (e) { Alert.alert('Error', 'Failed'); }
        }
      },
    ]);
  };

  const openVisitorModal = (visitor) => {
    setSelectedVisitor(visitor);
    setShowVisitorModal(true);
  };

  const getTimeInside = (entryTime) => {
    const ms = Date.now() - new Date(entryTime).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Admin Control" subtitle={user?.full_name || 'Administrator'} rightIcon="notifications-outline" onRightPress={() => navigation.navigate('Notifications')} rightBadge={unreadCount} />

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
        
        {/* LOCKDOWN BANNER */}
        {lockdown && (
          <TouchableOpacity style={styles.lockdownBanner} activeOpacity={0.9} onPress={handleLiftLockdown}>
            <Ionicons name="lock-closed" size={28} color="#FF3333" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
              <Text style={styles.lockdownReason}>Reason: {lockdown.reason}</Text>
              <Text style={styles.lockdownSince}>Since: {new Date(lockdown.activated_at).toLocaleString('en-IN')}</Text>
            </View>
            <Text style={{ color: '#FF6666', fontSize: 10, fontWeight: '700' }}>TAP TO LIFT</Text>
          </TouchableOpacity>
        )}

        {/* === OVERVIEW STATS GRID === */}
        <Text style={styles.sectionTitle}>Campus Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="people" label="Total Users" value={stats?.total_users || 0} color={Colors.primary} />
            <StatCard icon="today" label="Visits Today" value={stats?.visits_today || 0} color={Colors.secondary} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="calendar" label="This Week" value={stats?.visits_this_week || 0} color="#a78bfa" />
            <StatCard icon="calendar-outline" label="This Month" value={stats?.visits_this_month || 0} color="#f59e0b" />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="hourglass" label="Awaiting Staff" value={stats?.pending_requests || 0} color={Colors.warning} />
            <StatCard icon="qr-code" label="Active Passes" value={stats?.active_passes || 0} color={Colors.success} />
          </View>
        </View>

        {/* Breakdown pills */}
        <View style={styles.breakdownRow}>
          <View style={styles.breakdownPill}>
            <Ionicons name="shield" size={14} color={Colors.secondary} />
            <Text style={styles.breakdownText}>{stats?.total_guards || 0} Guards</Text>
          </View>
          <View style={styles.breakdownPill}>
            <Ionicons name="school" size={14} color={Colors.primary} />
            <Text style={styles.breakdownText}>{stats?.total_staff || 0} Staff</Text>
          </View>
          <View style={styles.breakdownPill}>
            <Ionicons name="school-outline" size={14} color="#a78bfa" />
            <Text style={styles.breakdownText}>{stats?.professor_visits_today || 0} Prof</Text>
          </View>
          <View style={styles.breakdownPill}>
            <Ionicons name="people-outline" size={14} color="#f59e0b" />
            <Text style={styles.breakdownText}>{stats?.general_visits_today || 0} General</Text>
          </View>
        </View>

        {/* === VISITORS CURRENTLY INSIDE CAMPUS === */}
        <View style={styles.insideSection}>
          <View style={styles.insideHeader}>
            <View style={styles.insideHeaderLeft}>
              <View style={[styles.insidePulse, { backgroundColor: stillInside.count > 0 ? '#22c55e' : Colors.textMuted }]} />
              <Text style={styles.insideTitle}>
                {stillInside.count > 0 ? `${stillInside.count} Visitor${stillInside.count !== 1 ? 's' : ''} Inside Campus` : 'No Visitors Inside'}
              </Text>
            </View>
            {stillInside.count > 0 && (
              <View style={styles.liveBadge}>
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>

          {stillInside.visitors.length > 0 && (
            <View style={styles.insideList}>
              {stillInside.visitors.map((v, i) => {
                const isOverstay = new Date(v.valid_until) < new Date();
                return (
                  <TouchableOpacity key={`inside-${v.pass_id}-${i}`} style={[styles.insideRow, isOverstay && styles.insideRowOverstay]} activeOpacity={0.7} onPress={() => openVisitorModal(v)}>
                    {v.visitor_photo ? (
                      <Image source={{ uri: `${getBaseUrl()}${v.visitor_photo}` }} style={styles.insideAvatar} />
                    ) : (
                      <View style={styles.insideAvatarPlaceholder}>
                        <Text style={styles.insideAvatarInitial}>{v.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <View style={styles.insideNameRow}>
                        <Text style={styles.insideName} numberOfLines={1}>{v.visitor_name}</Text>
                        {isOverstay && (
                          <View style={styles.overstayPill}>
                            <Text style={styles.overstayPillText}>⚠️ OVERSTAY</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.insideMeta}>📱 {v.visitor_phone}</Text>
                      <Text style={styles.insideMeta}>
                        🕐 Entered {new Date(v.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • {getTimeInside(v.entry_time)} ago
                      </Text>
                      {v.staff_name && <Text style={styles.insideMeta}>🎓 Visiting {v.staff_name}</Text>}
                      {v.visit_type !== 'professor_visit' && <Text style={styles.insideMeta}>👥 General Visit</Text>}
                    </View>
                    <View style={styles.insideActions}>
                      <TouchableOpacity style={styles.forceExitBtn} onPress={() => handleForceExit(v.pass_id, v.visitor_name)}>
                        <Ionicons name="log-out-outline" size={14} color="#ef4444" />
                        <Text style={styles.forceExitText}>Exit</Text>
                      </TouchableOpacity>
                      <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} style={{ marginTop: 6 }} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {/* Pending Users Critical Alert */}
        {(stats?.pending_users || 0) > 0 && (
          <TouchableOpacity style={styles.pendingAlert} onPress={() => navigation.navigate('PendingUsers')} activeOpacity={0.8}>
            <View style={styles.pendingAlertGlow}><Ionicons name="people-circle" size={32} color={Colors.warning} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.pendingAlertTitle}>{stats.pending_users} New Registration{stats.pending_users > 1 ? 's' : ''}</Text>
              <Text style={styles.pendingAlertSub}>Awaiting verification & account activation</Text>
            </View>
            <Ionicons name="chevron-forward-circle" size={24} color={Colors.warning} />
          </TouchableOpacity>
        )}

        {/* === MANAGEMENT CONSOLE === */}
        <Text style={styles.sectionTitle}>Management Console</Text>
        <View style={styles.actionsGrid}>
          {[
            { icon: 'people', label: 'All Users', screen: 'UserManagement', color: Colors.primary, desc: 'Guards, Staff & Admins' },
            { icon: 'person-add', label: 'Pending Users', screen: 'PendingUsers', color: Colors.warning, desc: 'Approve / reject' },
            { icon: 'document-text', label: 'All Visits', screen: 'AllVisits', color: Colors.secondary, desc: 'Browse all records' },
            { icon: 'stats-chart', label: 'Day-Wise', screen: 'DayWiseRecords', color: Colors.success, desc: 'Daily analytics' },
            { icon: 'earth', label: 'Activity Logs', screen: 'ActivityLog', color: '#8B5CF6', desc: 'System events' },
            { icon: 'notifications', label: 'Notifications', screen: 'Notifications', color: '#EC4899', desc: 'All alerts' },
          ].map((a) => (
            <TouchableOpacity key={a.screen} style={styles.actionItem} onPress={() => navigation.navigate(a.screen)}>
              <View style={[styles.actionIconCircle, { backgroundColor: a.color + '15' }]}><Ionicons name={a.icon} size={26} color={a.color} /></View>
              <Text style={styles.actionLabel}>{a.label}</Text>
              <Text style={styles.actionDesc}>{a.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* === GUARD ACTIVITY (24h) === */}
        {guardActivity.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Guard Activity (24h)</Text>
            {guardActivity.map((g) => (
              <TouchableOpacity key={g.id} activeOpacity={0.8} onPress={() => navigation.navigate('UserDetail', { userId: g.id })}>
                <Card style={styles.guardCard}>
                  <View style={styles.guardRow}>
                    <View style={styles.guardAvatarCircle}>
                      <Text style={styles.guardInitial}>{g.full_name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <Text style={styles.guardName}>{g.full_name}</Text>
                      <Text style={styles.guardGate}>📍 {g.gate_assigned || 'Mobile Unit'}</Text>
                    </View>
                    <View style={styles.guardStats}>
                      <View style={styles.guardStatItem}>
                        <Text style={styles.guardStatNum}>{g.requests_today}</Text>
                        <Text style={styles.guardStatLbl}>REQUESTS</Text>
                      </View>
                      <View style={styles.guardStatDivider} />
                      <View style={styles.guardStatItem}>
                        <Text style={styles.guardStatNum}>{g.passes_today}</Text>
                        <Text style={styles.guardStatLbl}>PASSES</Text>
                      </View>
                      <View style={styles.guardStatDivider} />
                      <View style={styles.guardStatItem}>
                        <Text style={styles.guardStatNum}>{g.scans_today}</Text>
                        <Text style={styles.guardStatLbl}>SCANS</Text>
                      </View>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </>
        )}

        {/* Emergency Lockdown Button */}
        {!lockdown && (
          <TouchableOpacity style={styles.lockdownBtn} onPress={() => setLockdownModalVisible(true)} activeOpacity={0.8}>
            <Ionicons name="alert-circle" size={22} color="#ef4444" />
            <Text style={styles.lockdownBtnText}>Emergency Lockdown</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* === LOCKDOWN MODAL === */}
      <Modal visible={lockdownModalVisible} transparent animationType="fade" onRequestClose={() => setLockdownModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.lockdownModalContainer}>
            <Text style={styles.lockdownModalTitle}>🚨 Activate Campus Lockdown</Text>
            <Text style={styles.lockdownModalSubtitle}>This will REVOKE all active passes and notify all guards & staff immediately.</Text>
            <TextInput style={styles.lockdownModalInput} placeholder="Enter lockdown reason..." placeholderTextColor={Colors.textMuted}
              value={lockdownReason} onChangeText={setLockdownReason} multiline textAlignVertical="top" />
            <View style={styles.lockdownModalActions}>
              <TouchableOpacity style={styles.lockdownModalCancelBtn} onPress={() => setLockdownModalVisible(false)}>
                <Text style={styles.lockdownModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.lockdownConfirmBtn} onPress={handleActivateLockdown}>
                <Ionicons name="lock-closed" size={16} color="#fff" />
                <Text style={styles.lockdownConfirmText}>ACTIVATE LOCKDOWN</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* === VISITOR DETAIL MODAL === */}
      <Modal visible={showVisitorModal} transparent animationType="slide" onRequestClose={() => setShowVisitorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.visitorModalContainer}>
            <TouchableOpacity style={styles.visitorModalClose} onPress={() => setShowVisitorModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>

            {selectedVisitor && (
              <ScrollView contentContainerStyle={styles.visitorModalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.visitorModalHeader}>
                  {selectedVisitor.visitor_photo ? (
                    <Image source={{ uri: `${getBaseUrl()}${selectedVisitor.visitor_photo}` }} style={styles.visitorModalAvatar} />
                  ) : (
                    <View style={styles.visitorModalAvatarPlaceholder}>
                      <Ionicons name="person" size={48} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.visitorModalName}>{selectedVisitor.visitor_name}</Text>
                  <TouchableOpacity style={styles.visitorModalPhoneBtn} onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={16} color={Colors.primary} />
                    <Text style={styles.visitorModalPhone}>{selectedVisitor.visitor_phone}</Text>
                  </TouchableOpacity>
                </View>

                {/* Status dashboard */}
                <View style={styles.visitorStatusRow}>
                  <View style={[styles.visitorStatusCard, { borderColor: '#22c55e50' }]}>
                    <Ionicons name="log-in" size={20} color="#22c55e" />
                    <Text style={[styles.visitorStatusLabel, { color: '#22c55e' }]}>Entry</Text>
                    <Text style={styles.visitorStatusValue}>{new Date(selectedVisitor.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={[styles.visitorStatusCard, { borderColor: '#3b82f650' }]}>
                    <Ionicons name="time" size={20} color="#3b82f6" />
                    <Text style={[styles.visitorStatusLabel, { color: '#3b82f6' }]}>Duration</Text>
                    <Text style={styles.visitorStatusValue}>{getTimeInside(selectedVisitor.entry_time)}</Text>
                  </View>
                  <View style={[styles.visitorStatusCard, {
                    borderColor: new Date(selectedVisitor.valid_until) < new Date() ? '#ef444450' : '#22c55e50',
                  }]}>
                    <Ionicons name="alarm" size={20} color={new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e'} />
                    <Text style={[styles.visitorStatusLabel, { color: new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e' }]}>
                      {new Date(selectedVisitor.valid_until) < new Date() ? 'EXPIRED' : 'Valid'}
                    </Text>
                    <Text style={styles.visitorStatusValue}>{new Date(selectedVisitor.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.visitorInfoSection}>
                  <InfoRow icon={selectedVisitor.visit_type === 'professor_visit' ? 'school' : 'people'} label="Type" value={selectedVisitor.visit_type === 'professor_visit' ? 'Professor Visit' : 'General Visit'} />
                  {selectedVisitor.staff_name && <InfoRow icon="person" label="Visiting" value={selectedVisitor.staff_name} />}
                  <InfoRow icon="card" label="Pass Code" value={selectedVisitor.pass_code} mono />
                </View>

                {new Date(selectedVisitor.valid_until) < new Date() && (
                  <View style={styles.overstayAlert}>
                    <Ionicons name="warning" size={22} color="#f59e0b" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.overstayAlertTitle}>⚠️ Overstay Alert</Text>
                      <Text style={styles.overstayAlertText}>Pass expired. Visitor has been inside for {getTimeInside(selectedVisitor.entry_time)}.</Text>
                    </View>
                  </View>
                )}

                <View style={styles.visitorModalActions}>
                  <TouchableOpacity style={[styles.visitorActionBtn, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}
                    onPress={() => handleForceExit(selectedVisitor.pass_id, selectedVisitor.visitor_name)}>
                    <Ionicons name="log-out" size={20} color="#ef4444" />
                    <Text style={[styles.visitorActionText, { color: '#ef4444' }]}>Force Exit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.visitorActionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
                    onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={20} color={Colors.primary} />
                    <Text style={[styles.visitorActionText, { color: Colors.primary }]}>Call</Text>
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

function InfoRow({ icon, label, value, mono }) {
  return (
    <View style={styles.infoRow}>
      <Ionicons name={icon} size={18} color={Colors.textMuted} />
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace', letterSpacing: 2 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 60 },
  statsGrid: { marginBottom: Spacing.sm },
  statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.md, marginTop: Spacing.lg },

  // Breakdown pills
  breakdownRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg, flexWrap: 'wrap' },
  breakdownPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border },
  breakdownText: { fontSize: 11, color: Colors.textSecondary, fontWeight: '700' },

  // Lockdown
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a000015', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 2, borderColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: FontSizes.base, fontWeight: '900' },
  lockdownReason: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  lockdownSince: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  lockdownBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1.5, borderColor: '#ef444440', backgroundColor: '#ef444410', marginTop: Spacing.lg, marginBottom: Spacing.lg },
  lockdownBtnText: { color: '#ef4444', fontSize: FontSizes.sm, fontWeight: '800' },

  // === VISITORS INSIDE CAMPUS (Enhanced) ===
  insideSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: '#22c55e25', overflow: 'hidden', marginBottom: Spacing.md },
  insideHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  insideHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insidePulse: { width: 10, height: 10, borderRadius: 5 },
  insideTitle: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  liveBadge: { backgroundColor: '#22c55e20', borderWidth: 1, borderColor: '#22c55e50', paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  liveText: { fontSize: 10, color: '#22c55e', fontWeight: '900', letterSpacing: 1 },
  insideList: { paddingHorizontal: Spacing.sm },
  insideRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  insideRowOverstay: { backgroundColor: '#ef444408' },
  insideAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: '#22c55e40' },
  insideAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  insideAvatarInitial: { color: Colors.textMuted, fontSize: 16, fontWeight: '800' },
  insideNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insideName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '800', flex: 1 },
  insideMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  insideActions: { alignItems: 'center' },
  overstayPill: { backgroundColor: '#f59e0b20', borderWidth: 1, borderColor: '#f59e0b50', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  overstayPillText: { fontSize: 8, color: '#f59e0b', fontWeight: '900' },
  forceExitBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: '#ef444440', backgroundColor: '#ef444410' },
  forceExitText: { color: '#ef4444', fontSize: 11, fontWeight: '700' },

  // Pending alert
  pendingAlert: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warning + '12', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.warning + '30' },
  pendingAlertGlow: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.warning + '20', justifyContent: 'center', alignItems: 'center' },
  pendingAlertTitle: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  pendingAlertSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },

  // Management console grid
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  actionItem: { width: '48%', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  actionIconCircle: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  actionLabel: { color: Colors.text, fontSize: 14, fontWeight: '800' },
  actionDesc: { color: Colors.textMuted, fontSize: 10, marginTop: 2, textAlign: 'center' },

  // Guard activity cards (Enhanced)
  guardCard: { padding: Spacing.md, marginBottom: 8 },
  guardRow: { flexDirection: 'row', alignItems: 'center' },
  guardAvatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.secondary + '15', justifyContent: 'center', alignItems: 'center' },
  guardInitial: { color: Colors.secondary, fontSize: 18, fontWeight: '900' },
  guardName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  guardGate: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  guardStats: { flexDirection: 'row', backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.sm, paddingHorizontal: 8, paddingVertical: 8 },
  guardStatItem: { alignItems: 'center', paddingHorizontal: 8 },
  guardStatDivider: { width: 1, backgroundColor: Colors.border },
  guardStatNum: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '900' },
  guardStatLbl: { color: Colors.textMuted, fontSize: 7, fontWeight: '700', letterSpacing: 0.5, marginTop: 2 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },

  // Lockdown modal
  lockdownModalContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border, elevation: 10 },
  lockdownModalTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800', marginBottom: 4 },
  lockdownModalSubtitle: { color: Colors.textMuted, fontSize: FontSizes.sm, marginBottom: Spacing.lg },
  lockdownModalInput: { backgroundColor: Colors.background, color: Colors.text, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 80 },
  lockdownModalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: 12 },
  lockdownModalCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  lockdownModalCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: FontSizes.sm },
  lockdownConfirmBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: '#dc2626' },
  lockdownConfirmText: { color: '#fff', fontWeight: '800', fontSize: 12 },

  // Visitor detail modal (bottom sheet)
  visitorModalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', minHeight: '55%', width: '100%', paddingTop: 16, position: 'absolute', bottom: 0, left: 0, right: 0 },
  visitorModalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  visitorModalContent: { padding: Spacing.lg, paddingBottom: 40 },
  visitorModalHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  visitorModalAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#22c55e40' },
  visitorModalAvatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.border },
  visitorModalName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginTop: 12 },
  visitorModalPhoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '30' },
  visitorModalPhone: { color: Colors.primary, fontSize: FontSizes.base, fontWeight: '700' },

  visitorStatusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  visitorStatusCard: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1, backgroundColor: Colors.surface },
  visitorStatusLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
  visitorStatusValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', marginTop: 2 },

  visitorInfoSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  infoLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700', width: 80 },
  infoValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600', flex: 1 },

  overstayAlert: { flexDirection: 'row', backgroundColor: '#f59e0b12', borderWidth: 1, borderColor: '#f59e0b40', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  overstayAlertTitle: { color: '#f59e0b', fontSize: FontSizes.base, fontWeight: '800' },
  overstayAlertText: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 4 },

  visitorModalActions: { flexDirection: 'row', gap: 12 },
  visitorActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1 },
  visitorActionText: { fontSize: FontSizes.sm, fontWeight: '800' },
});
