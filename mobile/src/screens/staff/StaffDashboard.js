import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, Animated, Vibration, AppState, Modal, TextInput, Share, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// Sound support: add a notification.mp3 to assets/ and uncomment Audio import to enable
// import { Audio } from 'expo-av';
import { useAuth } from '../../context/AuthContext';
import { Card, StatCard, Header, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { visitService, notificationService, userService, dashboardService, preRegService, getBaseUrl, getPreRegUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';
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

function getToday() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Format response time nicely
function formatResponseTime(minutes) {
  if (!minutes && minutes !== 0) return null;
  const m = Math.round(minutes);
  if (m < 1) return '< 1 min';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function safeTime(value, fallback = '—') {
  const d = safeDate(value);
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : fallback;
}

function safeDateLabel(value, fallback = '—') {
  const d = safeDate(value);
  return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : fallback;
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
  
  // Reject modal state
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTargetId, setRejectTargetId] = useState(null);
  
  // Push notification popup state
  const [popupVisible, setPopupVisible] = useState(false);
  const [popupData, setPopupData] = useState(null);
  const popupAnim = useRef(new Animated.Value(-120)).current;
  const prevPendingRef = useRef(0);
  const hasInitializedRef = useRef(false);
  const soundRef = useRef(null);

  const playNotificationSound = () => {
    // Vibrate pattern: short-pause-short-pause-long
    Vibration.vibrate([0, 200, 100, 200, 100, 400]);
  };

  const showPopup = (visitorName, purpose) => {
    setPopupData({ visitorName, purpose });
    setPopupVisible(true);
    playNotificationSound();
    
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
        // FIX: Use backend date filters instead of fragile client-side filtering
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

      // Calculate average response time from today's approved requests
      const responseTimes = approvedToday.filter(v => v.response_time_minutes != null).map(v => parseFloat(v.response_time_minutes));
      const avgResponseTime = responseTimes.length > 0 ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null;

      // Detect new pending requests — popup with vibration
      if (hasInitializedRef.current && pending.length > prevPendingRef.current) {
        const newest = pending[0];
        if (newest) showPopup(newest.visitor_name, newest.purpose);
      }
      hasInitializedRef.current = true;
      prevPendingRef.current = pending.length;

      setStats({
        pending: pending.length,
        approvedToday: approvedToday.length,
        rejectedToday: rejectedToday.length,
        preVisits: preVisits.length,
        avgResponseTime,
      });

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

  // Auto-refresh every 15 seconds for real-time feel
  useEffect(() => {
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') loadData();
    }, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Cleanup sound on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current?.unloadAsync) soundRef.current.unloadAsync();
    };
  }, []);

  const handleQuickApprove = async (requestId) => {
    setActionLoading(requestId);
    try {
      await visitService.approve(requestId, { validity_hours: 4 });
      Alert.alert('Approved ✅', 'Request approved for 4 hours');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleQuickReject = (requestId) => {
    setRejectTargetId(requestId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const handlePreVisitApprove = async (preRegId) => {
    setActionLoading(preRegId);
    try {
      await preRegService.approve(preRegId, { validity_hours: 8 });
      Alert.alert('Approved ✅', 'Pre-registration approved. QR code & SMS sent to visitor.');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePreVisitReject = async (preRegId) => {
    setRejectTargetId(preRegId);
    setRejectReason('');
    setRejectModalVisible(true);
  };

  const confirmReject = async () => {
    setRejectModalVisible(false);
    if (!rejectTargetId) return;
    setActionLoading(rejectTargetId);
    try {
      // Check if this is a pre-visit rejection
      const isPreVisit = preVisitData.some(p => p.id === rejectTargetId);
      if (isPreVisit) {
        await preRegService.reject(rejectTargetId, { reason: rejectReason.trim() || undefined });
      } else {
        await visitService.reject(rejectTargetId, { reason: rejectReason.trim() || undefined });
      }
      Alert.alert('Rejected', 'Request has been rejected');
      loadData();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to reject');
    } finally {
      setActionLoading(null);
      setRejectTargetId(null);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      {/* Push Notification Popup Banner */}
      {popupVisible && popupData && (
        <Animated.View style={[styles.popupBanner, { transform: [{ translateY: popupAnim }] }]}>
          <View style={styles.popupGlow}><Ionicons name="alert-circle" size={28} color="#fff" /></View>
          <View style={styles.popupContent}>
            <Text style={styles.popupTitle}>🔔 New Visit Request!</Text>
            <Text style={styles.popupText} numberOfLines={1}>{popupData.visitorName} — {popupData.purpose}</Text>
          </View>
          <TouchableOpacity style={styles.popupAction} onPress={() => {
            popupAnim.setValue(-120);
            setPopupVisible(false);
            setActiveTab('pending');
          }}>
            <Text style={styles.popupActionText}>View</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <Header title="Staff Portal" subtitle={user?.full_name} rightIcon="notifications-outline" onRightPress={() => navigation.navigate('Notifications')} rightBadge={unreadCount} />

      {/* 🚨 LOCKDOWN BANNER */}
      {lockdown && (
        <View style={styles.lockdownBanner}>
          <Ionicons name="lock-closed" size={24} color="#FF3333" />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={styles.lockdownTitle}>🚨 CAMPUS LOCKDOWN ACTIVE</Text>
            <Text style={styles.lockdownReason}>All visitor entry suspended — {lockdown.reason}</Text>
          </View>
        </View>
      )}

      {/* Share Pre-Reg Link */}
      <TouchableOpacity style={styles.sharePreRegBtn} onPress={async () => {
        const url = getPreRegUrl();
        try {
          await Share.share({
            message: `Pre-register your campus visit to IIEST Shibpur:\n${url}\n\nFill the form to get your QR code approved before arriving.`,
            title: 'IIEST Pre-Registration',
          });
        } catch (e) { console.log('Share error:', e); }
      }}>
        <Ionicons name="share-social" size={16} color="#a78bfa" />
        <Text style={styles.sharePreRegText}>Share Pre-Registration Link with Visitors</Text>
        <Ionicons name="chevron-forward" size={14} color="#a78bfa" />
      </TouchableOpacity>

      {/* Quick Actions Row */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ScanQR', { mode: 'verify' })}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#3b82f615' }]}>
            <Ionicons name="qr-code" size={20} color="#3b82f6" />
          </View>
          <Text style={styles.quickActionLabel}>Scan QR</Text>
          <Text style={styles.quickActionSub}>Verify visitor</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => setActiveTab('pending')}>
          <View style={[styles.quickActionIcon, { backgroundColor: Colors.warning + '15' }]}>
            <Ionicons name="hourglass" size={20} color={Colors.warning} />
          </View>
          <Text style={styles.quickActionLabel}>{stats.pending}</Text>
          <Text style={styles.quickActionSub}>Pending</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.quickActionBtn} onPress={() => navigation.navigate('ApprovalHistory')}>
          <View style={[styles.quickActionIcon, { backgroundColor: '#a78bfa15' }]}>
            <Ionicons name="time" size={20} color="#a78bfa" />
          </View>
          <Text style={styles.quickActionLabel}>History</Text>
          <Text style={styles.quickActionSub}>All records</Text>
        </TouchableOpacity>
      </View>

      {/* Availability Toggle */}
      <View style={styles.availRow}>
        {AVAIL_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[styles.availChip, availability === opt.key && { backgroundColor: opt.color + '20', borderColor: opt.color }]}
            onPress={async () => {
              setAvailability(opt.key);
              try { await userService.updateAvailability({ availability: opt.key }); } catch (e) { console.log('Availability error:', e); }
            }}
          >
            <Ionicons name={opt.icon} size={14} color={availability === opt.key ? opt.color : Colors.textMuted} />
            <Text style={[styles.availText, availability === opt.key && { color: opt.color }]} numberOfLines={1}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>
        
        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <StatCard icon="time" label="Awaiting" value={stats.pending} color={Colors.warning} />
          <StatCard icon="checkmark-done" label="Cleared" value={stats.approvedToday} color={Colors.success} />
          <StatCard icon="close-circle" label="Denied" value={stats.rejectedToday} color={Colors.danger} />
        </View>

        {/* Active Visitors Section */}
        {activeVisitorsSummary.total > 0 && (
          <View style={styles.activeVisitorsSection}>
            <View style={styles.activeVisitorsHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.activeDot, { backgroundColor: activeVisitorsSummary.inside > 0 ? '#22c55e' : Colors.textMuted }]} />
                <Text style={styles.activeVisitorsTitle}>Your Active Visitors</Text>
              </View>
              <View style={styles.activeVisitorsBadges}>
                {activeVisitorsSummary.inside > 0 && (
                  <View style={[styles.activeMiniPill, { backgroundColor: '#22c55e20', borderColor: '#22c55e50' }]}>
                    <Text style={[styles.activeMiniText, { color: '#22c55e' }]}>🟢 {activeVisitorsSummary.inside} Inside</Text>
                  </View>
                )}
                {activeVisitorsSummary.left > 0 && (
                  <View style={[styles.activeMiniPill, { backgroundColor: '#ef444420', borderColor: '#ef444450' }]}>
                    <Text style={[styles.activeMiniText, { color: '#ef4444' }]}>🔴 {activeVisitorsSummary.left} Left</Text>
                  </View>
                )}
                {activeVisitorsSummary.not_entered > 0 && (
                  <View style={[styles.activeMiniPill, { backgroundColor: '#f59e0b20', borderColor: '#f59e0b50' }]}>
                    <Text style={[styles.activeMiniText, { color: '#f59e0b' }]}>⚪ {activeVisitorsSummary.not_entered} Awaiting</Text>
                  </View>
                )}
              </View>
            </View>
            {activeVisitors.filter(v => v.campus_status === 'inside').slice(0, 5).map((v, idx) => (
              <TouchableOpacity key={`active-${v.request_id}-${idx}`} style={styles.activeVisitorRow}
                onPress={() => navigation.navigate('RequestDetail', { requestId: v.request_id })}>
                {v.visitor_photo ? (
                  <Image source={{ uri: resolvePhotoUrl(v.visitor_photo) }} style={styles.activeAvatar} />
                ) : (
                  <View style={styles.activeAvatarPlaceholder}>
                    <Text style={styles.activeAvatarInitial}>{v.visitor_name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.activeVisitorName}>{v.visitor_name}</Text>
                  <Text style={styles.activeVisitorMeta}>
                    {v.entry_time ? `Entered ${new Date(v.entry_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}` : 'Not entered'}
                    {v.minutes_inside ? ` • ${Math.round(v.minutes_inside)}m ago` : ''}
                  </Text>
                  {v.referred_by_name && <Text style={styles.activeVisitorMeta}>↩️ Referred by {v.referred_by_name}</Text>}
                </View>
                <View style={styles.activeStatusBadge}>
                  <View style={[styles.activeStatusDot, { backgroundColor: v.campus_status === 'inside' ? '#22c55e' : v.campus_status === 'left' ? '#ef4444' : '#f59e0b' }]} />
                  <Text style={styles.activeStatusText}>{v.campus_status === 'inside' ? 'Inside' : v.campus_status === 'left' ? 'Left' : 'Waiting'}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Today's Summary Card */}
        <View style={styles.dailySummary}>
          <View style={styles.dailySummaryHeader}>
            <Ionicons name="analytics" size={16} color={Colors.primary} />
            <Text style={styles.dailySummaryTitle}>Today's Summary</Text>
          </View>
          <View style={styles.dailySummaryRow}>
            <View style={styles.dailySummaryItem}>
              <Text style={styles.dailySummaryValue}>{stats.approvedToday + stats.rejectedToday}</Text>
              <Text style={styles.dailySummaryLabel}>Handled</Text>
            </View>
            <View style={[styles.dailySummaryDivider]} />
            <View style={styles.dailySummaryItem}>
              <Text style={[styles.dailySummaryValue, { color: Colors.success }]}>
                {stats.approvedToday + stats.rejectedToday > 0
                  ? Math.round((stats.approvedToday / (stats.approvedToday + stats.rejectedToday)) * 100) : 0}%
              </Text>
              <Text style={styles.dailySummaryLabel}>Approval Rate</Text>
            </View>
            <View style={[styles.dailySummaryDivider]} />
            <View style={styles.dailySummaryItem}>
              <Text style={[styles.dailySummaryValue, { color: '#a78bfa' }]}>
                {stats.avgResponseTime != null ? formatResponseTime(stats.avgResponseTime) : '—'}
              </Text>
              <Text style={styles.dailySummaryLabel}>Avg Response</Text>
            </View>
            <View style={[styles.dailySummaryDivider]} />
            <View style={styles.dailySummaryItem}>
              <Text style={[styles.dailySummaryValue, { color: '#f59e0b' }]}>{stats.preVisits}</Text>
              <Text style={styles.dailySummaryLabel}>Pre-Visits</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Activity</Text>
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
            <EmptyState icon={activeTab === 'pending' ? 'cafe-outline' : 'calendar-outline'} title={activeTab === 'pending' ? "Coffee break?" : "No records today"} message={activeTab === 'pending' ? "All requests have been handled." : "Requests will appear here as they come."} compact />
          ) : activeTab !== 'pre_visits' ? (
            tabData.slice(0, 15).map((request, reqIndex) => (
              <Card key={`req-${request.id}-${reqIndex}`} style={[styles.requestCard, request.status === 'pending' && styles.requestCardPending]} onPress={() => navigation.navigate('RequestDetail', { requestId: request.id })}>
                <View style={styles.requestRow}>
                  <View style={styles.userSection}>
                    {request.visitor_photo ? (
                      <Image source={{ uri: resolvePhotoUrl(request.visitor_photo) }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}><Ionicons name="person" size={24} color={Colors.textMuted} /></View>
                    )}
                    <View style={styles.infoSection}>
                      <View style={styles.nameRow}>
                        <Text style={styles.visitorName} numberOfLines={1}>{request.visitor_name}</Text>
                        {/* Repeat visitor badge */}
                        {request.visit_count > 1 && (
                          <View style={styles.repeatBadge}>
                            <Text style={styles.repeatBadgeText}>{request.visit_count}x</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="call-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.visitorMeta}>{request.visitor_phone}</Text>
                        {/* Quick dial */}
                        <TouchableOpacity onPress={() => request.visitor_phone && Linking.openURL(`tel:${request.visitor_phone}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                          <Ionicons name="call" size={13} color={Colors.primary} />
                        </TouchableOpacity>
                      </View>
                      <View style={styles.metaRow}>
                        <Ionicons name="shield-outline" size={11} color={Colors.textMuted} />
                        <Text style={styles.visitorMeta}>{request.guard_name || 'Guard'}</Text>
                      </View>
                      <View style={styles.purposeBox}>
                        <Ionicons name="document-text-outline" size={12} color={Colors.textMuted} />
                        <Text style={styles.purposeText} numberOfLines={2}>{request.purpose}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.statusSection}>
                    <Badge text={request.status} variant={request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'} size="sm" />
                    <Text style={styles.timeText}>{safeTime(request.created_at)}</Text>
                    {/* Response time */}
                    {request.response_time_minutes != null && (
                      <View style={styles.responseTimePill}>
                        <Ionicons name="timer-outline" size={10} color="#a78bfa" />
                        <Text style={styles.responseTimeText}>{formatResponseTime(request.response_time_minutes)}</Text>
                      </View>
                    )}
                    {/* Meeting status mini-indicator for approved requests */}
                    {request.status === 'approved' && (
                      <View style={styles.meetingDot}>
                        <Ionicons
                          name={request.meeting_status === 'met' ? 'checkmark-circle' : request.meeting_status === 'not_met' ? 'close-circle' : 'help-circle-outline'}
                          size={12}
                          color={request.meeting_status === 'met' ? '#22c55e' : request.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted}
                        />
                        <Text style={[
                          styles.meetingDotText,
                          { color: request.meeting_status === 'met' ? '#22c55e' : request.meeting_status === 'not_met' ? '#ef4444' : Colors.textMuted }
                        ]}>
                          {request.meeting_status === 'met' ? 'Met' : request.meeting_status === 'not_met' ? 'Not Met' : 'Unconfirmed'}
                        </Text>
                      </View>
                    )}
                    {/* SMS status for approved */}
                    {request.status === 'approved' && request.sms_sent != null && (
                      <View style={styles.smsPill}>
                        <Ionicons name={request.sms_sent ? 'chatbubble-ellipses' : 'chatbubble-outline'} size={10} color={request.sms_sent ? '#22c55e' : Colors.textMuted} />
                        <Text style={[styles.smsText, { color: request.sms_sent ? '#22c55e' : Colors.textMuted }]}>
                          {request.sms_sent ? 'SMS ✓' : 'No SMS'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Quick Actions for Pending */}
                {request.status === 'pending' && (
                  <View style={styles.quickActionRow}>
                    <Button title="Approve" icon="checkmark" variant="success" size="sm" style={{ flex: 1 }} onPress={() => handleQuickApprove(request.id)} loading={actionLoading === request.id} />
                    <Button title="Reject" icon="close" variant="danger" size="sm" style={{ flex: 1, marginLeft: 10 }} onPress={() => handleQuickReject(request.id)} loading={actionLoading === request.id} />
                  </View>
                )}
              </Card>
            ))
          ) : null}

          {/* Pre-Visit cards */}
          {activeTab === 'pre_visits' && preVisitData.length === 0 && (
            <EmptyState icon="calendar-outline" title="No pre-visit requests" message="Pre-visit requests from visitors will appear here." compact />
          )}
          {activeTab === 'pre_visits' && preVisitData.length > 0 && preVisitData.map((preReg, preIndex) => (
            <Card key={`prereg-${preReg.id}-${preIndex}`} style={[styles.requestCard, styles.requestCardPending, { borderLeftColor: '#a78bfa' }]}>
              <View style={styles.requestRow}>
                <View style={styles.userSection}>
                  {preReg.visitor_photo ? (
                    <Image source={{ uri: resolvePhotoUrl(preReg.visitor_photo) }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}><Ionicons name="person" size={24} color={Colors.textMuted} /></View>
                  )}
                  <View style={styles.infoSection}>
                    <Text style={styles.visitorName}>{preReg.visitor_name}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="call-outline" size={11} color={Colors.textMuted} />
                      <Text style={styles.visitorMeta}>{preReg.visitor_phone}</Text>
                      <TouchableOpacity onPress={() => Linking.openURL(`tel:${preReg.visitor_phone}`)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Ionicons name="call" size={13} color={Colors.primary} />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.purposeBox}>
                      <Ionicons name="document-text-outline" size={12} color={Colors.textMuted} />
                      <Text style={styles.purposeText} numberOfLines={2}>{preReg.purpose}</Text>
                    </View>
                    <View style={[styles.metaRow, { marginTop: 6 }]}>
                      <Ionicons name="calendar-outline" size={11} color="#a78bfa" />
                      <Text style={[styles.visitorMeta, { color: '#a78bfa', fontWeight: '700' }]}>
                        📅 {safeDateLabel(preReg.scheduled_date)}{preReg.scheduled_time ? ` at ${preReg.scheduled_time}` : ''}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.statusSection}>
                  <Badge text="Pre-Visit" variant="info" size="sm" />
                </View>
              </View>
              <View style={styles.quickActionRow}>
                <Button title="Approve" icon="checkmark" variant="success" size="sm" style={{ flex: 1 }} onPress={() => handlePreVisitApprove(preReg.id)} loading={actionLoading === preReg.id} />
                <Button title="Reject" icon="close" variant="danger" size="sm" style={{ flex: 1, marginLeft: 10 }} onPress={() => handlePreVisitReject(preReg.id)} loading={actionLoading === preReg.id} />
              </View>
            </Card>
          ))}
        </View>

        <TouchableOpacity style={styles.historyBtn} onPress={() => navigation.navigate('ApprovalHistory')}>
          <Text style={styles.historyBtnText}>View Full History</Text>
          <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>

        {/* Last Refresh Indicator */}
        {lastRefresh && (
          <Text style={styles.lastRefresh}>
            Last updated: {lastRefresh.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} • Auto-refreshes every 15s
          </Text>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Reject Reason Modal */}
      <Modal visible={rejectModalVisible} transparent animationType="fade" onRequestClose={() => setRejectModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Reject Request</Text>
            <Text style={styles.modalSubtitle}>Provide a reason for rejection (optional)</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. Not expecting any visitors today"
              placeholderTextColor={Colors.textMuted}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setRejectModalVisible(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalRejectBtn} onPress={confirmReject}>
                <Ionicons name="close" size={16} color="#fff" />
                <Text style={styles.modalRejectText}>Reject</Text>
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
  statsContainer: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingHorizontal: 4 },
  tabRow: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 4, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: BorderRadius.md, gap: 4 },
  activeTab: { backgroundColor: Colors.background, elevation: 2 },
  tabText: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  activeTabText: { color: Colors.primary },
  listSection: { minHeight: 200 },
  requestCard: { padding: Spacing.md, marginBottom: 12, elevation: 4, borderWidth: 1, borderColor: Colors.border },
  requestCardPending: { borderLeftWidth: 3, borderLeftColor: Colors.warning },
  requestRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  userSection: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceLight },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.surfaceLight, justifyContent: 'center', alignItems: 'center' },
  infoSection: { marginLeft: Spacing.md, flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  visitorName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  visitorMeta: { color: Colors.textMuted, fontSize: 11, flex: 1 },
  purposeBox: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, backgroundColor: Colors.surfaceLight, padding: 6, borderRadius: 4 },
  purposeText: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  statusSection: { alignItems: 'flex-end', marginLeft: Spacing.sm },
  timeText: { color: Colors.textMuted, fontSize: 10, marginTop: 4, fontWeight: '600' },
  quickActionRow: { flexDirection: 'row', marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  historyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, gap: 8 },
  historyBtnText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700' },

  // Daily Summary Card
  dailySummary: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  dailySummaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  dailySummaryTitle: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '800' },
  dailySummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  dailySummaryItem: { alignItems: 'center', flex: 1 },
  dailySummaryValue: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '900' },
  dailySummaryLabel: { color: Colors.textMuted, fontSize: 9, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },
  dailySummaryDivider: { width: 1, height: 30, backgroundColor: Colors.border },

  // Repeat visitor badge
  repeatBadge: { backgroundColor: '#a78bfa20', borderWidth: 1, borderColor: '#a78bfa50', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 1 },
  repeatBadgeText: { fontSize: 9, color: '#a78bfa', fontWeight: '800' },

  // Response time pill
  responseTimePill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: '#a78bfa12', borderRadius: 4 },
  responseTimeText: { fontSize: 9, color: '#a78bfa', fontWeight: '700' },

  // SMS pill
  smsPill: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 3 },
  smsText: { fontSize: 9, fontWeight: '700' },

  // Last refresh
  lastRefresh: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: Spacing.sm, fontStyle: 'italic' },

  // Popup Banner
  popupBanner: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.warning, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: 48, elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8 },
  popupGlow: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  popupContent: { flex: 1, marginLeft: 12 },
  popupTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  popupText: { color: 'rgba(255,255,255,0.9)', fontSize: 12, marginTop: 2 },
  popupAction: { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  popupActionText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  meetingDot: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 5 },
  meetingDotText: { fontSize: 9, fontWeight: '700' },

  // Reject Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContainer: { backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl, width: '100%', maxWidth: 380, borderWidth: 1, borderColor: Colors.border, elevation: 10 },
  modalTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800', marginBottom: 4 },
  modalSubtitle: { color: Colors.textMuted, fontSize: FontSizes.sm, marginBottom: Spacing.lg },
  modalInput: { backgroundColor: Colors.background, color: Colors.text, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: FontSizes.base, borderWidth: 1, borderColor: Colors.border, minHeight: 80 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.lg, gap: 12 },
  modalCancelBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  modalCancelText: { color: Colors.textSecondary, fontWeight: '700', fontSize: FontSizes.sm },
  modalRejectBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.md, backgroundColor: Colors.danger },
  modalRejectText: { color: '#fff', fontWeight: '700', fontSize: FontSizes.sm },

  // Availability
  availRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: 6 },
  availChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  availText: { color: Colors.textMuted, fontSize: 10, fontWeight: '700' },
  // Lockdown
  lockdownBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FF333318', paddingHorizontal: Spacing.lg, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: '#FF333340' },
  lockdownTitle: { color: '#FF3333', fontSize: 14, fontWeight: '900' },
  lockdownReason: { color: '#FF6666', fontSize: 11, marginTop: 2 },

  // Share Pre-Reg
  sharePreRegBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: Spacing.base, marginTop: Spacing.sm, paddingVertical: 12, backgroundColor: '#a78bfa12', borderWidth: 1, borderColor: '#a78bfa30', borderRadius: BorderRadius.md },
  sharePreRegText: { color: '#a78bfa', fontSize: FontSizes.sm, fontWeight: '700' },

  // Quick Actions Row
  quickActionsRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingTop: Spacing.md, gap: 10 },
  quickActionBtn: { flex: 1, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  quickActionIcon: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  quickActionLabel: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  quickActionSub: { color: Colors.textMuted, fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Active Visitors Section
  activeVisitorsSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.base },
  activeVisitorsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.sm },
  activeVisitorsTitle: { color: Colors.text, fontSize: FontSizes.md, fontWeight: '800' },
  activeVisitorsBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeMiniPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  activeMiniText: { fontSize: 10, fontWeight: '700' },
  activeVisitorRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border + '50' },
  activeAvatar: { width: 38, height: 38, borderRadius: 19 },
  activeAvatarPlaceholder: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.primary + '20', justifyContent: 'center', alignItems: 'center' },
  activeAvatarInitial: { color: Colors.primary, fontSize: 16, fontWeight: '800' },
  activeVisitorName: { color: Colors.text, fontSize: 13, fontWeight: '700' },
  activeVisitorMeta: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  activeStatusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full, backgroundColor: Colors.background },
  activeStatusDot: { width: 6, height: 6, borderRadius: 3 },
  activeStatusText: { fontSize: 10, color: Colors.textSecondary, fontWeight: '700' },
});
