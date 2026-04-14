import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, Share, Linking, TextInput, Modal, Dimensions, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { visitService, notificationService, dashboardService, userService, gatePassService, getPreRegUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const TABS = [
  { key: 'pending', label: 'Pending', icon: 'hourglass' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getTimeStr() {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function getDateStr() {
  return new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

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
  const [expectedArrivals, setExpectedArrivals] = useState([]);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearch, setShowSearch] = useState(false);

  // Visitor detail modal
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [showVisitorModal, setShowVisitorModal] = useState(false);

  // SOS modal
  const [showSOS, setShowSOS] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [visitsRes, notifRes, lockdownRes, insideRes, expectedRes] = await Promise.all([
        visitService.getAll({ limit: 100 }),
        notificationService.getUnreadCount(),
        dashboardService.getLockdownStatus().catch(() => ({ data: { data: { is_lockdown: false } } })),
        userService.getStillInside().catch(() => ({ data: { data: { visitors: [], count: 0 } } })),
        dashboardService.getExpectedArrivals().catch(() => ({ data: { data: { expected_arrivals: [] } } })),
      ]);

      const visits = visitsRes.data?.data?.visits || [];
      const today = new Date().toDateString();
      setUnreadCount(notifRes.data?.data?.count || 0);
      setLockdown(lockdownRes.data?.data?.is_lockdown ? lockdownRes.data.data.lockdown : null);
      setExpectedArrivals(expectedRes.data?.data?.expected_arrivals || []);

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
  useEffect(() => {
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Search
  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (text.trim().length < 2) { setSearchResults([]); return; }
    try {
      const res = await visitService.searchVisitors(text.trim());
      setSearchResults(res.data?.data?.visitors || []);
    } catch (e) { console.log('Search error:', e); }
  };

  // SOS
  const handleSOS = async () => {
    setSosSending(true);
    try {
      Vibration.vibrate([0, 300, 100, 300, 100, 500]);
      await dashboardService.sendSOS({ message: sosMessage.trim() || 'Emergency at gate!', location: user?.gate_assigned || 'Unknown' });
      Alert.alert('🚨 SOS Sent', 'Emergency alert has been sent to all admins and guards.');
      setShowSOS(false);
      setSosMessage('');
    } catch (e) {
      Alert.alert('Error', 'Failed to send SOS');
    } finally {
      setSosSending(false);
    }
  };

  // Generate QR
  const handleGenerateQR = async (visitId) => {
    try {
      const res = await gatePassService.generate(visitId);
      const pass = res.data?.data?.gate_pass;
      if (pass) navigation.navigate('GenerateQR', { pass });
    } catch (error) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to generate pass');
    }
  };

  // Send SMS
  const handleSendSMS = async (visitId) => {
    try {
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

  // Force exit
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
      {/* ══════════ HEADER ══════════ */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>{getGreeting()} 👋</Text>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <Text style={styles.gateBadge}>{user?.gate_assigned || 'Gate Security'}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.timeText}>{getTimeStr()}</Text>
          <Text style={styles.dateText}>{getDateStr()}</Text>
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
        <View style={styles.lockdownBanner}>
          <Ionicons name="lock-closed" size={20} color="#FF3333" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
            <Text style={styles.lockdownReason}>No entry/exit — {lockdown.reason}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        {/* ══════════ REAL-TIME VISITOR COUNT ══════════ */}
        <View style={styles.visitorCountCard}>
          <View style={styles.countLeft}>
            <Text style={styles.countLabel}>REAL-TIME VISITOR COUNT</Text>
            <View style={styles.countRow}>
              <Text style={styles.countNumber}>{insideCount}</Text>
              <Text style={styles.countUnit}>Active Visitors</Text>
            </View>
          </View>
          {insideCount > 0 && (
            <View style={styles.livePulse}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
        </View>

        {/* ══════════ ALERT CARDS ══════════ */}
        {stats.pending > 0 && (
          <TouchableOpacity style={styles.alertCard} onPress={() => setActiveTab('pending')}>
            <View style={styles.alertBadge}>
              <Text style={styles.alertBadgeText}>ALERT</Text>
            </View>
            <Text style={styles.alertText}>
              <Text style={styles.alertCount}>{stats.pending}</Text> Pending Request{stats.pending > 1 ? 's' : ''}
            </Text>
            <Text style={styles.alertSub}>Needs attention</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.warning} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        )}

        {/* ══════════ SCAN PASS — BIG CTA ══════════ */}
        <TouchableOpacity style={styles.scanCTA} onPress={() => navigation.navigate('ScanQR')} activeOpacity={0.8}>
          <View style={styles.scanIcon}>
            <Ionicons name="qr-code" size={32} color="#fff" />
          </View>
          <View>
            <Text style={styles.scanTitle}>SCAN PASS / QR CODE</Text>
            <Text style={styles.scanSub}>Quick Entry Scan</Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={28} color="rgba(255,255,255,0.5)" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        {/* ══════════ STATS ROW ══════════ */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons name="hourglass" size={20} color={Colors.warning} />
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Awaiting</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="shield-checkmark" size={20} color={Colors.success} />
            <Text style={styles.statValue}>{stats.approvedToday}</Text>
            <Text style={styles.statLabel}>Cleared</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="today" size={20} color={Colors.primary} />
            <Text style={styles.statValue}>{stats.totalToday}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
        </View>

        {/* ══════════ EXPECTED ARRIVALS ══════════ */}
        {expectedArrivals.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={16} color="#a78bfa" />
              <Text style={styles.sectionTitle}>Expected Arrivals Today</Text>
              <View style={styles.countPill}>
                <Text style={styles.countPillText}>{expectedArrivals.length}</Text>
              </View>
            </View>
            {expectedArrivals.slice(0, 4).map((arrival, idx) => (
              <View key={`exp-${arrival.id}-${idx}`} style={styles.arrivalRow}>
                <View style={[styles.arrivalIcon, { backgroundColor: arrival.status === 'approved' ? '#22c55e15' : '#f59e0b15' }]}>
                  <Ionicons name={arrival.status === 'approved' ? 'checkmark-circle' : 'time'} size={16} color={arrival.status === 'approved' ? '#22c55e' : '#f59e0b'} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.arrivalName}>{arrival.visitor_name}</Text>
                  <Text style={styles.arrivalMeta}>To: {arrival.staff_name} {arrival.scheduled_time ? `• ${arrival.scheduled_time}` : ''}</Text>
                </View>
                <Badge text={arrival.status} variant={arrival.status === 'approved' ? 'success' : 'warning'} size="sm" />
              </View>
            ))}
          </View>
        )}

        {/* ══════════ QUICK ACTIONS ══════════ */}
        <Text style={styles.sectionTitleText}>QUICK ACTIONS</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateVisitRequest')}>
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.primary + '12' }]}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.actionLabel}>Walk-In{'\n'}Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('CreateGeneralVisit')}>
            <View style={[styles.actionIconWrap, { backgroundColor: Colors.success + '12' }]}>
              <Ionicons name="people" size={24} color={Colors.success} />
            </View>
            <Text style={styles.actionLabel}>General{'\n'}Entry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('IncidentReport')}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#f9731612' }]}>
              <Ionicons name="warning" size={24} color="#f97316" />
            </View>
            <Text style={styles.actionLabel}>Report{'\n'}Incident</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowSOS(true)}>
            <View style={[styles.actionIconWrap, { backgroundColor: '#ef444420' }]}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
            </View>
            <Text style={[styles.actionLabel, { color: '#ef4444' }]}>SOS{'\n'}Alert</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════ UTILITY ROW ══════════ */}
        <View style={styles.utilityRow}>
          <TouchableOpacity style={styles.utilityBtn} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name="search" size={16} color={Colors.primary} />
            <Text style={[styles.utilityText, { color: Colors.primary }]}>Search</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityBtn} onPress={async () => {
            try { await Share.share({ message: `Pre-register your campus visit to IIEST Shibpur:\n${getPreRegUrl()}`, title: 'IIEST Pre-Reg' }); } catch (e) {}
          }}>
            <Ionicons name="share-social" size={16} color="#a78bfa" />
            <Text style={[styles.utilityText, { color: '#a78bfa' }]}>Pre-Reg Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilityBtn} onPress={() => navigation.navigate('EmergencyContacts')}>
            <Ionicons name="call" size={16} color="#ef4444" />
            <Text style={[styles.utilityText, { color: '#ef4444' }]}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* ══════════ SEARCH ══════════ */}
        {showSearch && (
          <View style={styles.searchSection}>
            <View style={styles.searchInputRow}>
              <Ionicons name="search" size={18} color={Colors.textMuted} />
              <TextInput style={styles.searchInput} placeholder="Search by name or phone..." placeholderTextColor={Colors.textMuted} value={searchQuery} onChangeText={handleSearch} autoFocus />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
            {searchResults.length > 0 && (
              <View style={styles.searchResults}>
                {searchResults.slice(0, 6).map((v, idx) => (
                  <View key={`search-${v.id}-${idx}`} style={styles.searchResultItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{v.full_name}</Text>
                      <Text style={styles.searchResultMeta}>📱 {v.phone} • {v.total_visits} visit{v.total_visits != 1 ? 's' : ''}</Text>
                    </View>
                    {v.is_blacklisted ? (
                      <Badge text="🚨 BLOCKED" variant="danger" size="sm" />
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

        {/* ══════════ RECENT ENTRIES (Live Feed) ══════════ */}
        {recentEntries.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="pulse" size={16} color={Colors.success} />
              <Text style={styles.sectionTitle}>Recent Entries (Live Feed)</Text>
            </View>
            {recentEntries.map((entry, index) => (
              <TouchableOpacity key={`inside-${entry.pass_id}-${index}`} style={styles.entryRow} activeOpacity={0.7} onPress={() => { setSelectedVisitor(entry); setShowVisitorModal(true); }}>
                {entry.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(entry.visitor_photo) }} style={styles.entryAvatar} />
                ) : (
                  <View style={styles.entryAvatarPlaceholder}>
                    <Text style={styles.entryAvatarLetter}>{entry.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.entryName}>{entry.visitor_name}</Text>
                  <Text style={styles.entryMeta}>
                    {entry.visit_type === 'professor_visit' ? `🎓 ${entry.staff_name}` : '👥 General'} • Pass #{entry.pass_code?.slice(-4)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.entryTime}>{new Date(entry.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  <Text style={styles.entryStatus}>
                    {new Date(entry.valid_until) < new Date() ? '⚠️ Overstay' : '✅ Entry OK'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════════ RECENT ACTIVITY TABS ══════════ */}
        <Text style={styles.sectionTitleText}>RECENT ACTIVITY</Text>
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
            <EmptyState icon="clipboard-outline" title="Quiet so far" message="No records found for this status today." />
          ) : (
            tabData.slice(0, 12).map((visit, idx) => (
              <TouchableOpacity key={`visit-${visit.id}-${idx}`} style={styles.visitCard} onPress={() => navigation.navigate('EditVisitRequest', { requestId: visit.id })} activeOpacity={0.7}>
                <View style={styles.visitRow}>
                  {visit.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(visit.visitor_photo) }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{visit.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.visitInfo}>
                    <Text style={styles.visitorName}>{visit.visitor_name}</Text>
                    <Text style={styles.visitMeta}>📱 {visit.visitor_phone}</Text>
                    <Text style={styles.visitMeta} numberOfLines={1}>🎓 {visit.staff_name} ({visit.staff_department})</Text>
                    <View style={styles.purposeTag}>
                      <Text style={styles.purposeText} numberOfLines={1}>{visit.purpose}</Text>
                    </View>
                  </View>
                  <View style={styles.statusCol}>
                    <Badge text={visit.status} variant={visit.status === 'pending' ? 'warning' : visit.status === 'approved' ? 'success' : 'danger'} size="sm" />
                    <Text style={styles.visitTime}>{new Date(visit.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
                {(visit.status === 'approved' || visit.status === 'entered') && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity style={[styles.cardActionBtn, { backgroundColor: Colors.success + '10', borderColor: Colors.success + '30' }]} onPress={() => handleGenerateQR(visit.id)}>
                      <Ionicons name="qr-code" size={14} color={Colors.success} />
                      <Text style={[styles.cardActionText, { color: Colors.success }]}>QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.cardActionBtn, { backgroundColor: '#a78bfa10', borderColor: '#a78bfa30' }]} onPress={() => handleSendSMS(visit.id)}>
                      <Ionicons name="chatbubble" size={14} color="#a78bfa" />
                      <Text style={[styles.cardActionText, { color: '#a78bfa' }]}>SMS</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>

      {/* ══════════ SOS MODAL ══════════ */}
      <Modal visible={showSOS} transparent animationType="fade" onRequestClose={() => setShowSOS(false)}>
        <View style={styles.sosOverlay}>
          <View style={styles.sosContainer}>
            <View style={styles.sosIconWrap}>
              <Ionicons name="alert-circle" size={56} color="#ef4444" />
            </View>
            <Text style={styles.sosTitle}>🚨 SOS EMERGENCY</Text>
            <Text style={styles.sosSub}>This will alert ALL admins and guards immediately</Text>
            <TextInput
              style={styles.sosInput}
              placeholder="Describe the emergency (optional)..."
              placeholderTextColor={Colors.textMuted}
              value={sosMessage}
              onChangeText={setSosMessage}
              multiline
            />
            <View style={styles.sosActions}>
              <TouchableOpacity style={styles.sosCancelBtn} onPress={() => setShowSOS(false)}>
                <Text style={styles.sosCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sosSendBtn} onPress={handleSOS} disabled={sosSending}>
                <Ionicons name="alert-circle" size={18} color="#fff" />
                <Text style={styles.sosSendText}>{sosSending ? 'Sending...' : 'SEND SOS'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════ VISITOR DETAIL MODAL ══════════ */}
      <Modal visible={showVisitorModal} transparent animationType="slide" onRequestClose={() => setShowVisitorModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowVisitorModal(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            {selectedVisitor && (
              <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
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

                <View style={styles.modalStatusRow}>
                  <View style={[styles.modalStatusCard, { borderColor: '#22c55e50', backgroundColor: '#22c55e08' }]}>
                    <Ionicons name="log-in" size={18} color="#22c55e" />
                    <Text style={[styles.modalStatusLabel, { color: '#22c55e' }]}>Entered</Text>
                    <Text style={styles.modalStatusValue}>{new Date(selectedVisitor.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View style={[styles.modalStatusCard, { borderColor: '#3b82f650', backgroundColor: '#3b82f608' }]}>
                    <Ionicons name="time" size={18} color="#3b82f6" />
                    <Text style={[styles.modalStatusLabel, { color: '#3b82f6' }]}>Duration</Text>
                    <Text style={styles.modalStatusValue}>{getTimeInside(selectedVisitor.entry_time)}</Text>
                  </View>
                  <View style={[styles.modalStatusCard, {
                    borderColor: new Date(selectedVisitor.valid_until) < new Date() ? '#ef444450' : '#22c55e50',
                    backgroundColor: new Date(selectedVisitor.valid_until) < new Date() ? '#ef444408' : '#22c55e08',
                  }]}>
                    <Ionicons name="alarm" size={18} color={new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e'} />
                    <Text style={[styles.modalStatusLabel, { color: new Date(selectedVisitor.valid_until) < new Date() ? '#ef4444' : '#22c55e' }]}>
                      {new Date(selectedVisitor.valid_until) < new Date() ? 'EXPIRED' : 'Valid'}
                    </Text>
                    <Text style={styles.modalStatusValue}>{new Date(selectedVisitor.valid_until).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#ef444412', borderColor: '#ef444430' }]} onPress={() => handleForceExit(selectedVisitor.pass_id, selectedVisitor.visitor_name)}>
                    <Ionicons name="log-out" size={20} color="#ef4444" />
                    <Text style={[styles.modalActionBtnText, { color: '#ef4444' }]}>Force Exit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: Colors.primary + '12', borderColor: Colors.primary + '30' }]} onPress={() => Linking.openURL(`tel:${selectedVisitor.visitor_phone}`)}>
                    <Ionicons name="call" size={20} color={Colors.primary} />
                    <Text style={[styles.modalActionBtnText, { color: Colors.primary }]}>Call</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.base, backgroundColor: Colors.background },
  greeting: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },
  userName: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginTop: 2 },
  gateBadge: { color: Colors.primary, fontSize: 11, fontWeight: '700', marginTop: 4, textTransform: 'uppercase', letterSpacing: 1 },
  headerRight: { alignItems: 'flex-end' },
  timeText: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },
  dateText: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  notifBtn: { marginTop: 8, padding: 8, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  notifBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Lockdown
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF333318', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: 13, fontWeight: '900' },
  lockdownReason: { color: '#FF6666', fontSize: 11, marginTop: 2 },

  // Real-time visitor count
  visitorCountCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1.5, borderColor: insideCount => insideCount > 0 ? '#22c55e30' : Colors.border },
  countLeft: { flex: 1 },
  countLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 4 },
  countNumber: { color: Colors.text, fontSize: 42, fontWeight: '900' },
  countUnit: { color: Colors.textSecondary, fontSize: FontSizes.base, fontWeight: '600' },
  livePulse: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#22c55e15', paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  liveText: { fontSize: 10, color: '#22c55e', fontWeight: '900', letterSpacing: 1 },

  // Alert card
  alertCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f59e0b10', borderWidth: 1, borderColor: '#f59e0b30', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, gap: 10 },
  alertBadge: { backgroundColor: '#f59e0b', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  alertBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  alertText: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  alertCount: { fontSize: FontSizes.xl, fontWeight: '900', color: '#f59e0b' },
  alertSub: { color: Colors.textMuted, fontSize: 10 },

  // Scan CTA
  scanCTA: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, gap: 14, ...Shadows.lg },
  scanIcon: { width: 54, height: 54, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  scanTitle: { color: '#fff', fontSize: FontSizes.lg, fontWeight: '900', letterSpacing: 0.5 },
  scanSub: { color: 'rgba(255,255,255,0.7)', fontSize: FontSizes.sm, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginTop: 6 },
  statLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2 },

  // Section
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800', flex: 1 },
  sectionTitleText: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm, paddingHorizontal: 4 },
  countPill: { backgroundColor: '#a78bfa20', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countPillText: { color: '#a78bfa', fontSize: 10, fontWeight: '800' },

  // Expected arrivals
  arrivalRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50' },
  arrivalIcon: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  arrivalName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  arrivalMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },

  // Quick Actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  actionBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  actionIconWrap: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  actionLabel: { color: Colors.text, fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },

  // Utility
  utilityRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  utilityBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  utilityText: { fontSize: 10, fontWeight: '800' },

  // Search
  searchSection: { marginBottom: Spacing.lg },
  searchInputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, gap: 8 },
  searchInput: { flex: 1, paddingVertical: 12, color: Colors.text, fontSize: FontSizes.base },
  searchResults: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  searchResultName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  searchResultMeta: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },
  noResults: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', paddingVertical: Spacing.md },

  // Live feed entries
  entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50' },
  entryAvatar: { width: 36, height: 36, borderRadius: 18 },
  entryAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  entryAvatarLetter: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  entryName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  entryMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  entryTime: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700' },
  entryStatus: { color: Colors.success, fontSize: 9, fontWeight: '700', marginTop: 2 },

  // Tabs
  tabsContainer: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: BorderRadius.md, gap: 5 },
  activeTab: { backgroundColor: Colors.background, ...Shadows.sm },
  tabText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  activeTabText: { color: Colors.primary },
  listSection: { minHeight: 200 },

  // Visit cards
  visitCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  visitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceLight },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: Colors.primary, fontSize: 20, fontWeight: '800' },
  visitInfo: { marginLeft: 12, flex: 1 },
  visitorName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  visitMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  purposeTag: { marginTop: 6, backgroundColor: Colors.surfaceLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, alignSelf: 'flex-start' },
  purposeText: { color: Colors.textMuted, fontSize: 10 },
  statusCol: { alignItems: 'flex-end', marginLeft: 8 },
  visitTime: { color: Colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600' },

  // Card actions
  cardActions: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, gap: 8 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 6, paddingHorizontal: 14, borderRadius: BorderRadius.md, borderWidth: 1 },
  cardActionText: { fontSize: 11, fontWeight: '700' },

  // SOS Modal
  sosOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sosContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl, padding: Spacing.xl, width: '100%', maxWidth: 360, borderWidth: 2, borderColor: '#ef444440', alignItems: 'center' },
  sosIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ef444415', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  sosTitle: { color: '#ef4444', fontSize: FontSizes.xl, fontWeight: '900' },
  sosSub: { color: Colors.textMuted, fontSize: FontSizes.sm, textAlign: 'center', marginTop: 4, marginBottom: 20 },
  sosInput: { width: '100%', backgroundColor: Colors.background, borderRadius: BorderRadius.md, padding: Spacing.md, color: Colors.text, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 60, textAlignVertical: 'top' },
  sosActions: { flexDirection: 'row', marginTop: Spacing.lg, gap: 12, width: '100%' },
  sosCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  sosCancelText: { color: Colors.textSecondary, fontWeight: '700' },
  sosSendBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: BorderRadius.md, backgroundColor: '#ef4444' },
  sosSendText: { color: '#fff', fontWeight: '900', letterSpacing: 1 },

  // Visitor detail modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', minHeight: '50%', paddingTop: 16 },
  modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  modalContent: { padding: Spacing.lg, paddingBottom: 40 },
  modalHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  modalAvatar: { width: 88, height: 88, borderRadius: 44, borderWidth: 3, borderColor: '#22c55e40' },
  modalAvatarPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: Colors.border },
  modalName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginTop: 12 },
  modalPhoneRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, backgroundColor: Colors.primary + '10', borderWidth: 1, borderColor: Colors.primary + '30' },
  modalPhone: { color: Colors.primary, fontSize: FontSizes.base, fontWeight: '700' },
  modalStatusRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  modalStatusCard: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: BorderRadius.lg, borderWidth: 1 },
  modalStatusLabel: { fontSize: 9, fontWeight: '800', marginTop: 4, textTransform: 'uppercase' },
  modalStatusValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', marginTop: 2 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1 },
  modalActionBtnText: { fontSize: FontSizes.sm, fontWeight: '800' },
});
