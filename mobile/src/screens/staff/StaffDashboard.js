import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, Animated, Vibration, AppState, Modal, TextInput, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Card, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { visitService, notificationService, userService, dashboardService, preRegService, getPreRegUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';

const TABS = [
  { key: 'pending', label: 'Pending', icon: 'hourglass' },
  { key: 'pre_visits', label: 'Pre-Visits', icon: 'calendar' },
  { key: 'approved', label: 'Approved', icon: 'checkmark-circle' },
  { key: 'rejected', label: 'Rejected', icon: 'close-circle' },
];

const AVAIL_OPTIONS = [
  { key: 'available', label: 'Available', icon: 'checkmark-circle', color: '#22c55e' },
  { key: 'in_meeting', label: 'In Meeting', icon: 'people', color: '#f59e0b' },
  { key: 'on_leave', label: 'On Leave', icon: 'airplane', color: '#3b82f6' },
  { key: 'unavailable', label: 'Unavailable', icon: 'close-circle', color: '#ef4444' },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatResponseTime(minutes) {
  if (!minutes && minutes !== 0) return null;
  const m = Math.round(minutes);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function safeTime(value, fallback = '—') {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fallback;
}

function safeDateLabel(value, fallback = '—') {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : fallback;
}

export default function StaffDashboard({ navigation }) {
  const { user } = useAuth();
  const [stats, setStats] = useState({ pending: 0, approvedToday: 0, rejectedToday: 0, preVisits: 0, avgResponseTime: null });
  const [activeTab, setActiveTab] = useState('pending');
  const [tabData, setTabData] = useState([]);
  const [preVisitData, setPreVisitData] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [availability, setAvailability] = useState(user?.availability || 'available');
  const [lockdown, setLockdown] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [activeVisitors, setActiveVisitors] = useState([]);
  const [activeVisitorsSummary, setActiveVisitorsSummary] = useState({ inside: 0, left: 0, not_entered: 0, total: 0 });

  // Reject modal
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState(null);

  // Push popup
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const popupAnim = useRef(new Animated.Value(-120)).current;
  const prevPendingRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const soundRef = useRef(null);

  // SOS modal
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [sosMessage, setSosMessage] = useState('');
  const [sosSending, setSosSending] = useState(false);

  const showPopup = (visitorName, purpose) => {
    setPopupData({ visitorName, purpose });
    setPopupVisible(true);
    Vibration.vibrate([0, 200, 100, 200, 100, 400]);
    Animated.sequence([
      Animated.spring(popupAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.delay(4000),
      Animated.timing(popupAnim, { toValue: -120, duration: 300, useNativeDriver: true }),
    ]).start(() => { setPopupVisible(false); setPopupData(null); });
  };

  const loadData = useCallback(async () => {
    try {
      const today = getToday();
      const [pendingRes, approvedTodayRes, rejectedTodayRes, notifRes, lockdownRes, preRegRes, activeRes] = await Promise.all([
        visitService.getStaffHistory({ limit: 100, status: 'pending' }),
        visitService.getStaffHistory({ limit: 50, status: 'approved', date_from: today, date_to: today }),
        visitService.getStaffHistory({ limit: 50, status: 'rejected', date_from: today, date_to: today }),
        notificationService.getUnreadCount(),
        dashboardService.getLockdownStatus().catch(() => ({ data: { data: { is_lockdown: false } } })),
        preRegService.getPending().catch(() => ({ data: { data: { pre_registrations: [] } } })),
        visitService.getStaffActive().catch(() => ({ data: { data: { visitors: [], summary: { inside: 0, left: 0, not_entered: 0, total: 0 } } } })),
      ]);

      const pending = pendingRes.data?.data?.history || [];
      const approvedToday = approvedTodayRes.data?.data?.history || [];
      const rejectedToday = rejectedTodayRes.data?.data?.history || [];
      const preVisits = preRegRes.data?.data?.pre_registrations || [];

      setUnreadCount(notifRes.data?.data?.count || 0);
      setLockdown(lockdownRes.data?.data?.is_lockdown ? lockdownRes.data.data.lockdown : null);
      setPreVisitData(preVisits);
      setActiveVisitors(activeRes.data?.data?.visitors || []);
      setActiveVisitorsSummary(activeRes.data?.data?.summary || { inside: 0, left: 0, not_entered: 0, total: 0 });
      setLastRefresh(new Date());

      const responseTimes = approvedToday.filter(v => v.response_time_minutes != null).map(v => parseFloat(v.response_time_minutes));
      const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null;

      if (hasInitializedRef.current && pending.length > prevPendingRef.current) {
        const newest = pending[0];
        if (newest) showPopup(newest.visitor_name, newest.purpose);
      }
      hasInitializedRef.current = true;
      prevPendingRef.current = pending.length;

      setStats({ pending: pending.length, approvedToday: approvedToday.length, rejectedToday: rejectedToday.length, preVisits: preVisits.length, avgResponseTime });

      if (activeTab === 'pending') setTabData(pending);
      else if (activeTab === 'pre_visits') setTabData(preVisits);
      else if (activeTab === 'approved') setTabData(approvedToday);
      else setTabData(rejectedToday);
    } catch (e) {
      console.log('Staff Dashboard error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);
  useEffect(() => {
    const interval = setInterval(() => { if (AppState.currentState === 'active') loadData(); }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);
  useEffect(() => { return () => { if (soundRef.current?.unloadAsync) soundRef.current.unloadAsync(); }; }, []);

  const handleQuickApprove = async (requestId) => {
    setActionLoading(requestId);
    try {
      await visitService.approve(requestId, { validity_hours: 4 });
      Alert.alert('Approved ✅', 'Request approved for 4 hours');
      loadData();
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handleQuickReject = (requestId) => { setRejectTargetId(requestId); setRejectReason(''); setRejectModalVisible(true); };

  const handlePreVisitApprove = async (preRegId) => {
    setActionLoading(preRegId);
    try {
      await preRegService.approve(preRegId, { validity_hours: 8 });
      Alert.alert('Approved ✅', 'Pre-registration approved. QR & SMS sent to visitor.');
      loadData();
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); }
  };

  const handlePreVisitReject = (preRegId) => { setRejectTargetId(preRegId); setRejectReason(''); setRejectModalVisible(true); };

  const confirmReject = async () => {
    setRejectModalVisible(false);
    if (!rejectTargetId) return;
    setActionLoading(rejectTargetId);
    try {
      const isPreVisit = preVisitData.some(p => p.id === rejectTargetId);
      if (isPreVisit) await preRegService.reject(rejectTargetId, { reason: rejectReason.trim() || undefined });
      else await visitService.reject(rejectTargetId, { reason: rejectReason.trim() || undefined });
      Alert.alert('Rejected', 'Request has been rejected');
      loadData();
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setActionLoading(null); setRejectTargetId(null); }
  };

  const handleSOS = async () => {
    setSosSending(true);
    try {
      Vibration.vibrate([0, 300, 100, 300, 100, 500]);
      await dashboardService.sendSOS({ message: sosMessage.trim() || 'Emergency SOS from staff!', location: user?.department || 'Unknown' });
      Alert.alert('🚨 SOS Sent', 'Emergency alert sent to all admins and guards.');
      setShowSOSModal(false);
      setSosMessage('');
    } catch (e) { Alert.alert('Error', 'Failed to send SOS'); }
    finally { setSosSending(false); }
  };

  if (loading) return <LoadingScreen />;

  const availObj = AVAIL_OPTIONS.find(o => o.key === availability) || AVAIL_OPTIONS[0];

  return (
    <View style={styles.container}>
      {/* Push Notification Popup */}
      {popupVisible && popupData && (
        <Animated.View style={[styles.popupBanner, { transform: [{ translateY: popupAnim }] }]}>
          <View style={styles.popupGlow}><Ionicons name="alert-circle" size={28} color="#fff" /></View>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>🔔 New Visit Request!</Text>
            <Text style={styles.popupText} numberOfLines={1}>{popupData.visitorName} — {popupData.purpose}</Text>
          </View>
          <TouchableOpacity style={styles.popupAction} onPress={() => { popupAnim.setValue(-120); setPopupVisible(false); setActiveTab('pending'); }}>
            <Text style={styles.popupActionText}>View</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* ══════════ HEADER ══════════ */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>{getGreeting()} ☀️</Text>
          <Text style={styles.userName}>{user?.full_name}</Text>
          <View style={styles.deptRow}>
            <View style={[styles.availIndicator, { backgroundColor: availObj.color }]} />
            <Text style={styles.deptText}>{user?.department || 'Staff'} • {availObj.label}</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.headerTime}>{new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</Text>
          <Text style={styles.headerDate}>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</Text>
          <TouchableOpacity style={styles.notifBtn} onPress={() => navigation.navigate('Notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Colors.text} />
            {unreadCount > 0 && <View style={styles.notifBadge}><Text style={styles.notifBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text></View>}
          </TouchableOpacity>
        </View>
      </View>

      {/* 🚨 LOCKDOWN */}
      {lockdown && (
        <View style={styles.lockdownBanner}>
          <Ionicons name="lock-closed" size={20} color="#FF3333" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
            <Text style={styles.lockdownReason}>All visitor entry suspended — {lockdown.reason}</Text>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        {/* ══════════ STAT CARDS ══════════ */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { borderLeftColor: stats.pending > 0 ? Colors.warning : Colors.textMuted }]}>
            <Ionicons name="hourglass" size={18} color={stats.pending > 0 ? Colors.warning : Colors.textMuted} />
            <Text style={styles.statValue}>{stats.pending}</Text>
            <Text style={styles.statLabel}>Pending{'\n'}Approvals</Text>
            {stats.pending > 0 && <View style={styles.statAlert}><Text style={styles.statAlertText}>!</Text></View>}
          </View>
          <View style={[styles.statCard, { borderLeftColor: Colors.success }]}>
            <Ionicons name="people" size={18} color={Colors.success} />
            <Text style={styles.statValue}>{activeVisitorsSummary.inside}</Text>
            <Text style={styles.statLabel}>Today's{'\n'}Visitors</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#a78bfa' }]}>
            <Ionicons name="document-text" size={18} color="#a78bfa" />
            <Text style={styles.statValue}>{stats.preVisits}</Text>
            <Text style={styles.statLabel}>Pre-{'\n'}registrations</Text>
          </View>
        </View>

        {/* ══════════ QUICK ACTIONS ══════════ */}
        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.qaBtn} onPress={() => navigation.navigate('CreateVisitRequest')}>
            <View style={[styles.qaIcon, { backgroundColor: Colors.primary + '12' }]}>
              <Ionicons name="add-circle" size={22} color={Colors.primary} />
            </View>
            <Text style={styles.qaLabel}>Create Visit{'\n'}Request</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={async () => {
            try { await Share.share({ message: `Pre-register your campus visit to IIEST Shibpur:\n${getPreRegUrl()}`, title: 'IIEST Pre-Reg' }); } catch (e) {}
          }}>
            <View style={[styles.qaIcon, { backgroundColor: '#a78bfa12' }]}>
              <Ionicons name="share-social" size={22} color="#a78bfa" />
            </View>
            <Text style={styles.qaLabel}>Share{'\n'}Pre-Reg Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.qaBtn} onPress={() => navigation.navigate('ApprovalHistory')}>
            <View style={[styles.qaIcon, { backgroundColor: Colors.success + '12' }]}>
              <Ionicons name="checkmark-done" size={22} color={Colors.success} />
            </View>
            <Text style={styles.qaLabel}>My{'\n'}Approvals</Text>
          </TouchableOpacity>
        </View>

        {/* Availability */}
        <Text style={styles.sectionLabel}>AVAILABILITY STATUS</Text>
        <View style={styles.availRow}>
          {AVAIL_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.availChip, availability === opt.key && { backgroundColor: opt.color + '18', borderColor: opt.color }]}
              onPress={async () => {
                setAvailability(opt.key);
                try { await userService.updateAvailability({ availability: opt.key }); } catch (e) {}
              }}
            >
              <Ionicons name={opt.icon} size={14} color={availability === opt.key ? opt.color : Colors.textMuted} />
              <Text style={[styles.availText, availability === opt.key && { color: opt.color }]} numberOfLines={1}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════ TODAY'S SUMMARY ══════════ */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <Ionicons name="analytics" size={16} color={Colors.primary} />
            <Text style={styles.summaryTitle}>Today's Summary</Text>
          </View>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.primary }]}>{stats.approvedToday + stats.rejectedToday}</Text>
              <Text style={styles.summaryItemLabel}>Handled</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                {stats.approvedToday + stats.rejectedToday > 0 ? Math.round((stats.approvedToday / (stats.approvedToday + stats.rejectedToday)) * 100) : 0}%
              </Text>
              <Text style={styles.summaryItemLabel}>Approval Rate</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: '#a78bfa' }]}>{stats.avgResponseTime != null ? formatResponseTime(stats.avgResponseTime) : '—'}</Text>
              <Text style={styles.summaryItemLabel}>Avg Response</Text>
            </View>
          </View>
        </View>

        {/* ══════════ ACTIVE VISITORS ══════════ */}
        {activeVisitorsSummary.total > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="people" size={16} color="#22c55e" />
              <Text style={styles.sectionTitle}>Your Active Visitors</Text>
              <View style={styles.livePulse}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            </View>
            <View style={styles.activeStatusPills}>
              {activeVisitorsSummary.inside > 0 && (
                <View style={[styles.activePill, { backgroundColor: '#22c55e15', borderColor: '#22c55e40' }]}>
                  <Text style={[styles.activePillText, { color: '#22c55e' }]}>🟢 {activeVisitorsSummary.inside} Inside</Text>
                </View>
              )}
              {activeVisitorsSummary.left > 0 && (
                <View style={[styles.activePill, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}>
                  <Text style={[styles.activePillText, { color: '#ef4444' }]}>🔴 {activeVisitorsSummary.left} Left</Text>
                </View>
              )}
              {activeVisitorsSummary.not_entered > 0 && (
                <View style={[styles.activePill, { backgroundColor: '#f59e0b15', borderColor: '#f59e0b40' }]}>
                  <Text style={[styles.activePillText, { color: '#f59e0b' }]}>⚪ {activeVisitorsSummary.not_entered} Awaiting</Text>
                </View>
              )}
            </View>
            {activeVisitors.filter(v => v.campus_status === 'inside').slice(0, 5).map((v, idx) => (
              <TouchableOpacity key={`active-${v.request_id}-${idx}`} style={styles.activeRow} onPress={() => navigation.navigate('RequestDetail', { requestId: v.request_id })}>
                {v.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.activeAvatar} />
                ) : (
                  <View style={styles.activeAvatarPlaceholder}>
                    <Text style={styles.activeAvatarLetter}>{v.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.activeName}>{v.visitor_name}</Text>
                  <Text style={styles.activeMeta}>
                    {v.entry_time ? `Entered ${new Date(v.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Not entered'}
                    {v.minutes_inside ? ` • ${Math.round(v.minutes_inside)}m ago` : ''}
                  </Text>
                </View>
                <View style={[styles.activeStatusDot, { backgroundColor: v.campus_status === 'inside' ? '#22c55e' : v.campus_status === 'left' ? '#ef4444' : '#f59e0b' }]} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* ══════════ ACTIVITY TABS ══════════ */}
        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
        <View style={styles.tabRow}>
          {TABS.map((tab) => (
            <TouchableOpacity key={tab.key} style={[styles.tab, activeTab === tab.key && styles.activeTab]} onPress={() => setActiveTab(tab.key)}>
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.key ? Colors.primary : Colors.textMuted} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.listSection}>
          {tabData.length === 0 && activeTab !== 'pre_visits' ? (
            <EmptyState icon={activeTab === 'pending' ? 'cafe-outline' : 'calendar-outline'} title={activeTab === 'pending' ? "Coffee break?" : "No records today"} message={activeTab === 'pending' ? "All requests have been handled." : "Requests will appear here."} />
          ) : activeTab !== 'pre_visits' ? (
            tabData.slice(0, 15).map((request, reqIndex) => (
              <TouchableOpacity key={`req-${request.id}-${reqIndex}`} style={[styles.requestCard, request.status === 'pending' && styles.requestCardPending]} onPress={() => navigation.navigate('RequestDetail', { requestId: request.id })} activeOpacity={0.7}>
                <View style={styles.requestRow}>
                  {request.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(request.visitor_photo) }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarLetter}>{request.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.requestInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.visitorName} numberOfLines={1}>{request.visitor_name}</Text>
                      {request.visit_count > 1 && <View style={styles.repeatBadge}><Text style={styles.repeatText}>{request.visit_count}x</Text></View>}
                    </View>
                    <Text style={styles.requestMeta}>📱 {request.visitor_phone}</Text>
                    <Text style={styles.requestMeta} numberOfLines={1}>🛡️ {request.guard_name || 'Guard'}</Text>
                    <View style={styles.purposeTag}><Text style={styles.purposeText} numberOfLines={2}>{request.purpose}</Text></View>
                  </View>
                  <View style={styles.statusCol}>
                    <Badge text={request.status} variant={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'} size="sm" />
                    <Text style={styles.timeText}>{safeTime(request.created_at)}</Text>
                    {request.response_time_minutes != null && (
                      <View style={styles.responseTimePill}>
                        <Ionicons name="timer-outline" size={9} color="#a78bfa" />
                        <Text style={styles.responseTimeText}>{formatResponseTime(request.response_time_minutes)}</Text>
                      </View>
                    )}
                    {request.status === 'approved' && (
                      <View style={styles.meetingDot}>
                        <Ionicons name={request.meeting_status === 'met' ? 'checkmark-circle' : request.meeting_status === 'not_met' ? 'close-circle' : 'help-circle-outline'} size={11} color={request.meeting_status === 'met' ? '#22c55e' : request.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted} />
                        <Text style={[styles.meetingDotText, { color: request.meeting_status === 'met' ? '#22c55e' : request.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted }]}>
                          {request.meeting_status === 'met' ? 'Met' : request.meeting_status === 'not_met' ? 'Not Met' : 'Unconfirmed'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
                {request.status === 'pending' && (
                  <View style={styles.actionRow}>
                    <Button title="Approve" icon="checkmark" variant="success" size="sm" style={{ flex: 1 }} onPress={() => handleQuickApprove(request.id)} loading={actionLoading === request.id} />
                    <Button title="Reject" icon="close" variant="danger" size="sm" style={{ flex: 1, marginLeft: 10 }} onPress={() => handleQuickReject(request.id)} loading={actionLoading === request.id} />
                  </View>
                )}
              </TouchableOpacity>
            ))
          ) : null}

          {/* Pre-Visit cards */}
          {activeTab === 'pre_visits' && preVisitData.length === 0 && (
            <EmptyState icon="calendar-outline" title="No pre-visit requests" message="Pre-visit requests from visitors will appear here." />
          )}
          {activeTab === 'pre_visits' && preVisitData.map((preReg, preIndex) => (
            <View key={`prereg-${preReg.id}-${preIndex}`} style={[styles.requestCard, { borderLeftWidth: 3, borderLeftColor: '#a78bfa' }]}>
              <View style={styles.requestRow}>
                {preReg.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(preReg.visitor_photo) }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{preReg.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={styles.requestInfo}>
                  <Text style={styles.visitorName}>{preReg.visitor_name}</Text>
                  <Text style={styles.requestMeta}>📱 {preReg.visitor_phone}</Text>
                  <View style={styles.purposeTag}><Text style={styles.purposeText} numberOfLines={2}>{preReg.purpose}</Text></View>
                  <Text style={[styles.requestMeta, { color: '#a78bfa', fontWeight: '700', marginTop: 4 }]}>📅 {safeDateLabel(preReg.scheduled_date)}{preReg.scheduled_time ? ` at ${preReg.scheduled_time}` : ''}</Text>
                </View>
                <Badge text="Pre-Visit" variant="info" size="sm" />
              </View>
              <View style={styles.actionRow}>
                <Button title="Approve" icon="checkmark" variant="success" size="sm" style={{ flex: 1 }} onPress={() => handlePreVisitApprove(preReg.id)} loading={actionLoading === preReg.id} />
                <Button title="Reject" icon="close" variant="danger" size="sm" style={{ flex: 1, marginLeft: 10 }} onPress={() => handlePreVisitReject(preReg.id)} loading={actionLoading === preReg.id} />
              </View>
            </View>
          ))}
        </View>

        {/* Utility Links */}
        <View style={styles.utilityLinks}>
          <TouchableOpacity style={styles.utilLink} onPress={() => navigation.navigate('ApprovalHistory')}>
            <Ionicons name="time-outline" size={16} color={Colors.primary} />
            <Text style={styles.utilLinkText}>Full History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilLink} onPress={() => setShowSOSModal(true)}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={[styles.utilLinkText, { color: '#ef4444' }]}>SOS Alert</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.utilLink} onPress={() => navigation.navigate('EmergencyContacts')}>
            <Ionicons name="call" size={16} color="#f97316" />
            <Text style={[styles.utilLinkText, { color: '#f97316' }]}>Emergency</Text>
          </TouchableOpacity>
        </View>

        {lastRefresh && (
          <Text style={styles.lastRefresh}>Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Auto-refreshes every 15s</Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ══════════ REJECT MODAL ══════════ */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <Text style={styles.modalSub}>Provide a reason for rejection (optional)</Text>
            <TextInput style={styles.modalInput} placeholder="e.g. Not expecting visitors today" placeholderTextColor={Colors.textMuted} value={rejectReason} onChangeText={setRejectReason} multiline textAlignVertical="top" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={confirmReject}>
                <Ionicons name="close" size={14} color="#fff" />
                <Text style={styles.modalRejectText}>Reject</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══════════ SOS MODAL ══════════ */}
      <Modal visible={showSOSModal} transparent animationType="fade" onRequestClose={() => setShowSOSModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { borderColor: '#ef444440', borderWidth: 2 }]}>
            <View style={styles.sosIconWrap}><Ionicons name="alert-circle" size={48} color="#ef4444" /></View>
            <Text style={[styles.modalTitle, { color: '#ef4444', textAlign: 'center' }]}>🚨 SOS EMERGENCY</Text>
            <Text style={[styles.modalSub, { textAlign: 'center' }]}>This will alert ALL admins and guards immediately</Text>
            <TextInput style={styles.modalInput} placeholder="Describe the emergency (optional)..." placeholderTextColor={Colors.textMuted} value={sosMessage} onChangeText={setSosMessage} multiline textAlignVertical="top" />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowSOSModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalRejectBtn, { backgroundColor: '#ef4444' }]} onPress={handleSOS} disabled={sosSending}>
                <Ionicons name="alert-circle" size={14} color="#fff" />
                <Text style={styles.modalRejectText}>{sosSending ? 'Sending...' : 'SEND SOS'}</Text>
              </TouchableOpacity>
            </View>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.sm },
  greeting: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },
  userName: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginTop: 2 },
  deptRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  availIndicator: { width: 8, height: 8, borderRadius: 4 },
  deptText: { color: Colors.textMuted, fontSize: 11, fontWeight: '600' },
  headerRight: { alignItems: 'flex-end' },
  headerTime: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },
  headerDate: { color: Colors.textMuted, fontSize: 10, marginTop: 2 },
  notifBtn: { marginTop: 8, padding: 8, backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, position: 'relative' },
  notifBadge: { position: 'absolute', top: 2, right: 2, backgroundColor: '#ef4444', borderRadius: 8, minWidth: 16, height: 16, justifyContent: 'center', alignItems: 'center' },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  // Lockdown
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF333318', paddingHorizontal: Spacing.lg, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: 13, fontWeight: '900' },
  lockdownReason: { color: '#FF6666', fontSize: 11, marginTop: 2 },

  // Stats
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
  statCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.sm, paddingVertical: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 3, position: 'relative' },
  statValue: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginTop: 4 },
  statLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  statAlert: { position: 'absolute', top: -4, right: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.warning, justifyContent: 'center', alignItems: 'center' },
  statAlertText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Section label
  sectionLabel: { color: Colors.textMuted, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: Spacing.sm, marginTop: Spacing.sm, paddingHorizontal: 4 },

  // Quick actions
  quickActions: { flexDirection: 'row', gap: 10, marginBottom: Spacing.md },
  qaBtn: { flex: 1, alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  qaIcon: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  qaLabel: { color: Colors.text, fontSize: 10, fontWeight: '700', textAlign: 'center', lineHeight: 14 },

  // Availability
  availRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md },
  availChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  availText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },

  // Summary card
  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  summaryTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { fontSize: FontSizes.lg, fontWeight: '900' },
  summaryItemLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  summaryDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  // Active visitors section
  section: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.base, marginBottom: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  sectionTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800', flex: 1 },
  livePulse: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#22c55e15', paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#22c55e' },
  liveText: { fontSize: 9, color: '#22c55e', fontWeight: '900', letterSpacing: 1 },
  activeStatusPills: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full, borderWidth: 1 },
  activePillText: { fontSize: 10, fontWeight: '700' },
  activeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50' },
  activeAvatar: { width: 36, height: 36, borderRadius: 18 },
  activeAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  activeAvatarLetter: { color: Colors.primary, fontSize: 15, fontWeight: '800' },
  activeName: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  activeMeta: { color: Colors.textMuted, fontSize: 10, marginTop: 1 },
  activeStatusDot: { width: 10, height: 10, borderRadius: 5 },

  // Tabs
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: BorderRadius.md, gap: 4 },
  activeTab: { backgroundColor: Colors.background, ...Shadows.sm },
  tabText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  activeTabText: { color: Colors.primary },
  listSection: { minHeight: 200 },

  // Request cards
  requestCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  requestCardPending: { borderLeftWidth: 3, borderLeftColor: Colors.warning },
  requestRow: { flexDirection: 'row', alignItems: 'flex-start' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.surfaceLight },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: Colors.primary, fontSize: 20, fontWeight: '800' },
  requestInfo: { marginLeft: 12, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitorName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', flex: 1 },
  repeatBadge: { backgroundColor: '#a78bfa20', borderWidth: 1, borderColor: '#a78bfa40', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  repeatText: { fontSize: 9, color: '#a78bfa', fontWeight: '800' },
  requestMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  purposeTag: { marginTop: 6, backgroundColor: Colors.surfaceLight, padding: 6, borderRadius: 4 },
  purposeText: { color: Colors.textSecondary, fontSize: 11 },
  statusCol: { alignItems: 'flex-end', marginLeft: 8 },
  timeText: { color: Colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600' },
  responseTimePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#a78bfa12', borderRadius: 4 },
  responseTimeText: { fontSize: 9, color: '#a78bfa', fontWeight: '700' },
  meetingDot: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  meetingDotText: { fontSize: 9, fontWeight: '700' },
  actionRow: { flexDirection: 'row', marginTop: Spacing.sm, paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border },

  // Utility links
  utilityLinks: { flexDirection: 'row', gap: 8, marginTop: Spacing.md },
  utilLink: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  utilLinkText: { color: Colors.primary, fontSize: 11, fontWeight: '700' },

  lastRefresh: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: Spacing.md, fontStyle: 'italic' },

  // Popup Banner
  popupBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warning, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: 48, elevation: 20 },
  popupGlow: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  popupContent: { flex: 1, marginLeft: 12 },
  popupTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  popupText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  popupAction: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  popupActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xxl, padding: Spacing.xl, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border },
  modalTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800', marginBottom: 4 },
  modalSub: { color: Colors.textMuted, fontSize: FontSizes.sm, marginBottom: Spacing.lg },
  modalInput: { backgroundColor: Colors.background, color: Colors.text, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 70 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: 12 },
  modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: FontSizes.sm },
  modalRejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.danger },
  modalRejectText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },
  sosIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#ef444415', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: 12 },
});
