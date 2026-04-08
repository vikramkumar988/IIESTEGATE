import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, Share, Linking, TextInput, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard, Header, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { visitService, notificationService, dashboardService, userService, gatePassService, getBaseUrl, getPreRegUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';




const TABS = [
  { key: 'pending', label: 'Pending', icon: 'hourglass' },
  { key: 'approved', label: 'Approved Today', icon: 'checkmark-circle' },
  { key: 'rejected', label: 'Rejected Today', icon: 'close-circle' },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function GuardDashboard({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0, totalToday: 0 });
  const [activeTab, setActiveTab] = useState('pending');
  const [tabData, setTabData] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lockdown, setLockdown] = useState(null);
  const [insideCount, setInsideCount] = useState(0);
  const [recentEntries, setRecentEntries] = useState([]);

  // Visitor search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Visitor detail modal
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [visitsRes, notifRes, lockdownRes, insideRes] = await Promise.all([
        visitService.getAll({ limit: 100 }),
        notificationService.getUnreadCount(),
        dashboardService.getLockdownStatus().catch(() => ({ data: { data: { is_lockdown: false } } })),
        userService.getStillInside().catch(() => ({ data: { data: { visitors: [], count: 0 } } })),
      ]);

      const visits = visitsRes.data?.data?.visits || [];
      const today = new Date().toDateString();
      setUnreadCount(notifRes.data?.data?.count || 0);
      setLockdown(lockdownRes.data?.data?.is_lockdown ? lockdownRes.data.data.lockdown : null);

      // Visitors inside campus
      const insideData = insideRes.data?.data || {};
      setInsideCount(insideData.count || 0);
      setRecentEntries((insideData.visitors || []).slice(0, 5));

      const pending = visits.filter(v => v.status === 'pending');
      const approvedToday = visits.filter(v => (v.status === 'approved' || v.status === 'entered') && new Date(v.updated_at).toDateString() === today);
      const rejectedToday = visits.filter(v => (v.status === 'rejected' || v.status === 'cancelled') && new Date(v.updated_at).toDateString() === today);
      const totalToday = visits.filter(v => new Date(v.created_at).toDateString() === today);

      setStats({ pending: pending.length, approvedToday: approvedToday.length, rejectedToday: rejectedToday.length, totalToday: totalToday.length });

      if (activeTab === 'pending') setTabData(pending);
      else if (activeTab === 'approved') setTabData(approvedToday);
      else setTabData(rejectedToday);

    } catch (e) {
      console.log('Guard Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Visitor search
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    try {
      const res = await visitService.searchVisitors(text.trim());
      setSearchResults(res.data?.data?.visitors || []);
    } catch (e) { console.log('Search error:', e); }
  };

  // Share pre-registration link
  const sharePreRegLink = async () => {
    const url = getPreRegUrl();
    try {
      await Share.share({
        message: `Register your campus visit to IIEST Shibpur in advance:\n${url}\n\nFill the form and get your QR code approved before arriving.`,
        title: 'IIEST Pre-Registration',
      });
    } catch (e) { console.log('Share error:', e); }
  };

  // Emergency call
  const handleEmergencyCall = () => {
    Alert.alert(
      '🚨 Emergency Contact',
      'Call campus security control room?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Call Security', onPress: () => Linking.openURL('tel:9000000001') },
      ]
    );
  };

  // Generate QR for approved visit
  const handleGenerateQR = async (visitId) => {
    try {
      const res = await gatePassService.generate(visitId);
      const pass = res.data?.data?.gate_pass;
      if (pass) navigation.navigate('GenerateQR', { pass });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to generate pass');
    }
  };

  // Send SMS for a visit
  const handleSendSMS = async (visitId) => {
    try {
      // First generate/get the pass
      const passRes = await gatePassService.generate(visitId);
      const pass = passRes.data?.data?.gate_pass;
      if (pass) {
        const smsRes = await gatePassService.sendSMS(pass.id);
        Alert.alert(smsRes.data?.success ? '✅ SMS Sent' : '⚠️ SMS Failed', smsRes.data?.message || 'Check SMS service');
      }
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send SMS');
    }
  };

  // Open visitor detail modal
  const openVisitorModal = (entry) => {
    setSelectedVisitor(entry);
    setShowVisitorModal(true);
  };

  // Force exit visitor
  const handleForceExit = async (passId, name) => {
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

  if (loading) return <LoadingScreen />;

  // Calculate time inside for visitor modal
  const getTimeInside = (entryTime) => {
    const ms = Date.now() - new Date(entryTime).getTime();
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <View style={styles.container}>
      <Header title="Guard Post" subtitle={user?.gate_assigned || 'Gate Security'} rightIcon="notifications-outline" onRightPress={() => navigation.navigate('Notifications')} rightBadge={unreadCount} />

      {/* 🚨 LOCKDOWN BANNER */}
      {lockdown && (
        <View style={styles.lockdownBanner}>
          <Ionicons name="lock-closed" size={24} color="#FF3333" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
            <Text style={styles.lockdownReason}>No entry/exit allowed — {lockdown.reason}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
        
        {/* Visitors Inside Campus Badge */}
        <View style={styles.insideBadge}>
          <View style={styles.insideLeft}>
            <Ionicons name="people" size={22} color={insideCount > 0 ? '#22c55e' : Colors.textMuted} />
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.insideCount}>{insideCount}</Text>
              <Text style={styles.insideLabel}>Visitors Inside Campus</Text>
            </View>
          </View>
          {insideCount > 0 && (
            <View style={styles.insidePulse}>
              <View style={styles.insideDot} />
              <Text style={styles.insideLive}>LIVE</Text>
            </View>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <StatCard icon="time" label="Awaiting" value={stats.pending} color={Colors.warning} />
          <StatCard icon="shield-checkmark" label="Cleared" value={stats.approvedToday} color={Colors.success} />
          <StatCard icon="today" label="Today" value={stats.totalToday} color={Colors.primary} />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateVisitRequest')}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.primary + '15' }]}><Ionicons name="add-circle" size={28} color={Colors.primary} /></View>
            <Text style={styles.actionText}>New Visit</Text>
            <Text style={styles.actionSub}>Professor request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('ScanQR')}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.secondary + '15' }]}><Ionicons name="qr-code" size={24} color={Colors.secondary} /></View>
            <Text style={styles.actionText}>Scan Pass</Text>
            <Text style={styles.actionSub}>Verify QR</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateGeneralVisit')}>
            <View style={[styles.iconCircle, { backgroundColor: Colors.success + '15' }]}><Ionicons name="people" size={24} color={Colors.success} /></View>
            <Text style={styles.actionText}>General</Text>
            <Text style={styles.actionSub}>Quick entry</Text>
          </TouchableOpacity>
        </View>

        {/* Utility Actions Row */}
        <View style={styles.utilityRow}>
          <TouchableOpacity style={styles.utilityBtn} onPress={sharePreRegLink}>
            <Ionicons name="share-social" size={18} color="#a78bfa" />
            <Text style={[styles.utilityText, { color: '#a78bfa' }]}>Share Pre-Reg Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityBtn} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search" size={18} color={Colors.primary} />
            <Text style={[styles.utilityText, { color: Colors.primary }]}>Search Visitor</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityBtn} onPress={handleEmergencyCall}>
            <Ionicons name="call" size={18} color="#ef4444" />
            <Text style={[styles.utilityText, { color: '#ef4444' }]}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Visitor Search */}
        {showSearch && (
          <View style={styles.searchSection}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or phone..."
                placeholderTextColor={Colors.textMuted}
                value={searchQuery}
                onChangeText={handleSearch}
                autoFocus
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.slice(0, 8).map((v, idx) => (
                  <View key={`search-${v.id}-${idx}`} style={styles.searchResultItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{v.full_name}</Text>
                      <Text style={styles.searchResultMeta}>📱 {v.phone} • {v.total_visits} visit{v.total_visits != 1 ? 's' : ''}</Text>
                    </View>
                    {v.is_blacklisted ? (
                      <Badge text="Blacklisted" variant="danger" size="sm" />
                    ) : v.last_status ? (
                      <Badge text={v.last_status} variant={v.last_status === 'approved' ? 'success' : v.last_status === 'pending' ? 'warning' : 'danger'} size="sm" />
                    ) : null}
                  </View>
                ))}
              </View>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <Text style={styles.noResults}>No visitors found</Text>
            )}
          </View>
        )}

        {/* Recent Entries Today (Visitors currently inside) — CLICKABLE */}
        {recentEntries.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.sectionTitle}>🚪 Currently Inside Campus</Text>
            {recentEntries.map((entry, index) => (
              <TouchableOpacity key={`inside-${entry.pass_id}-${index}`} style={styles.recentEntry} activeOpacity={0.7} onPress={() => openVisitorModal(entry)}>
                {entry.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(entry.visitor_photo) }} style={styles.recentAvatar} />
                ) : (
                  <View style={styles.recentAvatarPlaceholder}><Ionicons name="person" size={16} color={Colors.textMuted} /></View>
                )}
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.recentName} numberOfLines={1}>{entry.visitor_name}</Text>
                  <Text style={styles.recentMeta}>
                    {entry.visit_type === 'professor_visit' ? `🎓 ${entry.staff_name || 'Staff'}` : '👥 General'} • Entered {new Date(entry.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <View style={styles.tapHint}>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
                {new Date(entry.valid_until) < new Date() && (
                  <View style={styles.overstayBadge}>
                    <Text style={styles.overstayText}>⚠️ Overstay</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Records Tabs */}
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.tabsContainer}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listSection}>
          {tabData.length === 0 ? (
            <EmptyState icon="clipboard-outline" title="Quiet so far" message="No records found for this status today." compact />
          ) : (
            tabData.slice(0, 15).map((visit, idx) => (
              <Card key={`visit-${visit.id}-${idx}`} style={styles.visitCard} onPress={() => navigation.navigate('EditVisitRequest', { requestId: visit.id })}>
                <View style={styles.visitRow}>
                  {visit.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(visit.visitor_photo) }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><Ionicons name="person" size={24} color={Colors.textMuted} /></View>
                  )}
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitorName}>{visit.visitor_name}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.visitorPhone}>{visit.visitor_phone}</Text>
                    </View>
                    <View style={styles.metaRow}>
                      <Ionicons name="school-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.staffMeta} numberOfLines={1}>To: {visit.staff_name} ({visit.staff_department})</Text>
                    </View>
                    <View style={styles.purposeTag}>
                      <Ionicons name="document-text-outline" size={11} color={Colors.textMuted} />
                      <Text style={styles.purposeText} numberOfLines={1}>{visit.purpose}</Text>
                    </View>
                  </View>
                  <View style={styles.statusCol}>
                    <Badge text={visit.status} variant={visit.status === 'pending' ? 'warning' : visit.status === 'approved' ? 'success' : 'danger'} size="sm" />
                    <Text style={styles.timeText}>{new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>

                {/* Action buttons based on status */}
                {visit.status === 'pending' && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.cardActionBtn} onPress={() => navigation.navigate('EditVisitRequest', { requestId: visit.id })}>
                      <Ionicons name="create-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.cardActionText, { color: Colors.primary }]}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {(visit.status === 'approved' || visit.status === 'entered') && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={[styles.cardActionBtn, styles.qrActionBtn]} onPress={() => handleGenerateQR(visit.id)}>
                      <Ionicons name="qr-code" size={16} color={Colors.success} />
                      <Text style={[styles.cardActionText, { color: Colors.success }]}>View QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cardActionBtn, styles.smsActionBtn]} onPress={() => handleSendSMS(visit.id)}>
                      <Ionicons name="chatbubble-outline" size={16} color="#a78bfa" />
                      <Text style={[styles.cardActionText, { color: '#a78bfa' }]}>Send SMS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </Card>
            ))
          )}
        </View>

        <TouchableOpacity style={styles.viewMore} onPress={() => navigation.navigate('GuardHistory')}>
          <Ionicons name="time-outline" size={18} color={Colors.primary} />
          <Text style={styles.viewMoreText}>View Complete History</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>

      {/* ===== VISITOR DETAIL MODAL ===== */}
      <Modal visible={showVisitorModal} transparent animationType="slide" onRequestClose={() => setShowVisitorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Close button */}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVisitorModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>

            {selectedVisitor && (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
                {/* Photo & Name */}
                <View style={styles.modalHeader}>
                  {selectedVisitor.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(selectedVisitor.visitor_photo) }} style={styles.modalAvatar} />
                  ) : (
                    <View style={styles.modalAvatarPlaceholder}>
                      <Ionicons name="person" size={48} color={Colors.textMuted} />
                    </View>
                  )}
                  <Text style={styles.modalName}>{selectedVisitor.visitor_name}</Text>
                  <TouchableOpacity style={styles.modalPhoneRow} onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={16} color={Colors.primary} />
                    <Text style={styles.modalPhone}>{selectedVisitor.visitor_phone}</Text>
                  </TouchableOpacity>
                </View>

                {/* Status Cards */}
                <View style={styles.modalStatusRow}>
                  <View style={[styles.modalStatusCard, { borderColor: '#22c55e50', backgroundColor: '#22c55e08' }]}>
                    <Ionicons name="log-in" size={20} color="#22c55e" />
                    <Text style={[styles.modalStatusLabel, { color: '#22c55e' }]}>Entered</Text>
                    <Text style={styles.modalStatusValue}>
                      {new Date(selectedVisitor.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={[styles.modalStatusCard, { borderColor: '#3b82f650', backgroundColor: '#3b82f608' }]}>
                    <Ionicons name="time" size={20} color="#3b82f6" />
                    <Text style={[styles.modalStatusLabel, { color: '#3b82f6' }]}>Duration</Text>
                    <Text style={styles.modalStatusValue}>{getTimeInside(selectedVisitor.entry_time)}</Text>
                  </View>
                  <View style={[styles.modalStatusCard, {
                    borderColor: new Date(selectedVisitor.valid_until) < new Date() ? '#ef444450' : '#22c55e50',
                    backgroundColor: new Date(selectedVisitor.valid_until) < new Date() ? '#ef444408' : '#22c55e08',
                  }]}>
                    <Ionicons name="alarm" size={20} color={new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e'} />
                    <Text style={[styles.modalStatusLabel, { color: new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e' }]}>
                      {new Date(selectedVisitor.valid_until) < new Date() ? 'EXPIRED' : 'Valid'}
                    </Text>
                    <Text style={styles.modalStatusValue}>
                      {new Date(selectedVisitor.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>

                {/* Visit Info */}
                <View style={styles.modalInfoSection}>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name={selectedVisitor.visit_type === 'professor_visit' ? 'school' : 'people'} size={18} color={Colors.textMuted} />
                    <Text style={styles.modalInfoLabel}>Visit Type</Text>
                    <Text style={styles.modalInfoValue}>
                      {selectedVisitor.visit_type === 'professor_visit' ? 'Professor Visit' : 'General Visit'}
                    </Text>
                  </View>
                  {selectedVisitor.staff_name && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="person" size={18} color={Colors.textMuted} />
                      <Text style={styles.modalInfoLabel}>Visiting</Text>
                      <Text style={styles.modalInfoValue}>{selectedVisitor.staff_name}</Text>
                    </View>
                  )}
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="card" size={18} color={Colors.textMuted} />
                    <Text style={styles.modalInfoLabel}>Pass Code</Text>
                    <Text style={[styles.modalInfoValue, { fontFamily: 'monospace', letterSpacing: 2 }]}>{selectedVisitor.pass_code}</Text>
                  </View>
                </View>

                {/* Overstay Warning */}
                {new Date(selectedVisitor.valid_until) < new Date() && (
                  <View style={styles.modalOverstayWarning}>
                    <Ionicons name="warning" size={22} color="#f59e0b" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.modalOverstayTitle}>⚠️ Overstay Alert</Text>
                      <Text style={styles.modalOverstayText}>
                        This visitor's pass expired at {new Date(selectedVisitor.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}. 
                        They have been inside for {getTimeInside(selectedVisitor.entry_time)}.
                      </Text>
                    </View>
                  </View>
                )}

                {/* Actions */}
                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}
                    onPress={() => handleForceExit(selectedVisitor.pass_id, selectedVisitor.visitor_name)}>
                    <Ionicons name="log-out" size={20} color="#ef4444" />
                    <Text style={[styles.modalActionBtnText, { color: '#ef4444' }]}>Force Exit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.primary + '15', borderColor: Colors.primary + '40' }]}
                    onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={20} color={Colors.primary} />
                    <Text style={[styles.modalActionBtnText, { color: Colors.primary }]}>Call Visitor</Text>
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
  statsContainer: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingHorizontal: 4 },
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  actionBtn: { alignItems: 'center', flex: 1 },
  iconCircle: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionText: { color: Colors.text, fontSize: 12, fontWeight: '700' },
  actionSub: { color: Colors.textMuted, fontSize: 9, marginTop: 2 },

  // Utility row
  utilityRow: { flexDirection: 'row', marginBottom: Spacing.lg, gap: 8 },
  utilityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  utilityText: { fontSize: 10, fontWeight: '800' },

  // Inside campus badge
  insideBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: '#22c55e30' },
  insideLeft: { flexDirection: 'row', alignItems: 'center' },
  insideCount: { fontSize: FontSizes.xxl, fontWeight: '900', color: Colors.text },
  insideLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  insidePulse: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  insideDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  insideLive: { fontSize: 10, color: '#22c55e', fontWeight: '900', letterSpacing: 1 },

  // Search
  searchSection: { marginBottom: Spacing.lg },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: Colors.text, fontSize: FontSizes.base },
  searchResults: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 8, overflow: 'hidden' },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  searchResultMeta: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },
  noResults: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', paddingVertical: Spacing.md },

  // Recent entries
  recentSection: { marginBottom: Spacing.lg },
  recentEntry: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: 6, borderWidth: 1, borderColor: Colors.border },
  recentAvatar: { width: 32, height: 32, borderRadius: 16 },
  recentAvatarPlaceholder: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  recentName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  recentMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  tapHint: { marginLeft: 4 },
  overstayBadge: { backgroundColor: '#f59e0b20', borderWidth: 1, borderColor: '#f59e0b50', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 6 },
  overstayText: { fontSize: 9, color: '#f59e0b', fontWeight: '800' },

  tabsContainer: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: BorderRadius.md, gap: 6 },
  activeTab: { backgroundColor: Colors.background, elevation: 1 },
  tabText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  activeTabText: { color: Colors.primary },
  listSection: { minHeight: 200 },
  visitCard: { padding: Spacing.md, marginBottom: 12, elevation: 4 },
  visitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceLight },
  avatarPlaceholder: { width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  visitInfo: { marginLeft: Spacing.md, flex: 1 },
  visitorName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  visitorPhone: { color: Colors.textSecondary, fontSize: 12 },
  staffMeta: { color: Colors.textMuted, fontSize: 11 },
  purposeTag: { marginTop: 6, backgroundColor: Colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  purposeText: { color: Colors.textMuted, fontSize: 10, fontStyle: 'italic' },
  statusCol: { alignItems: 'flex-end', marginLeft: Spacing.sm },
  timeText: { color: Colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Card action buttons
  cardActions: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 10 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: 12, borderRadius: BorderRadius.md },
  cardActionText: { fontSize: 12, fontWeight: '700' },
  qrActionBtn: { backgroundColor: Colors.success + '12', borderWidth: 1, borderColor: Colors.success + '30' },
  smsActionBtn: { backgroundColor: '#a78bfa12', borderWidth: 1, borderColor: '#a78bfa30' },

  viewMore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, paddingVertical: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  viewMoreText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },

  // Lockdown banner
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF333318', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: 14, fontWeight: '900' },
  lockdownReason: { color: '#FF6666', fontSize: 11, marginTop: 2 },

  // ===== VISITOR DETAIL MODAL =====
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%', minHeight: '60%', paddingTop: 16 },
  modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  modalContent: { padding: Spacing.lg, paddingBottom: 40 },
  modalHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  modalAvatar: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#22c55e40' },
  modalAvatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.border },
  modalName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginTop: 12 },
  modalPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '30' },
  modalPhone: { color: Colors.primary, fontSize: FontSizes.base, fontWeight: '700' },

  // Modal status cards
  modalStatusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  modalStatusCard: { flex: 1, alignItems: 'center', paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1 },
  modalStatusLabel: { fontSize: 10, fontWeight: '800', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  modalStatusValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', marginTop: 2 },

  // Modal info section
  modalInfoSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  modalInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  modalInfoLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700', width: 80 },
  modalInfoValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600', flex: 1 },

  // Overstay warning
  modalOverstayWarning: { flexDirection: 'row', backgroundColor: '#f59e0b12', borderWidth: 1, borderColor: '#f59e0b40', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  modalOverstayTitle: { color: '#f59e0b', fontSize: FontSizes.base, fontWeight: '800' },
  modalOverstayText: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 4 },

  // Modal action buttons
  modalActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1 },
  modalActionBtnText: { fontSize: FontSizes.sm, fontWeight: '800' },
});
