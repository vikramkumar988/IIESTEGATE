import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Badge, Button, EmptyState, LoadingScreen } from '../../components';
import { userService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const ORG_LABELS = { iiest: 'IIEST Shibpur', bank: 'United Bank / PNB', school: 'Model School', iti: 'ITI College', other: 'Other' };

export default function PendingUsers({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const res = await userService.getPendingUsers();
      setUsers(res.data?.data?.users || []);
    } catch (e) {
      console.log('Error loading pending users:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  const handleApprove = (user) => {
    Alert.alert(
      'Approve Registration',
      `Confirm approval for ${user.full_name} (${user.role})?\n\nOrg: ${ORG_LABELS[user.organization] || user.organization}\n${user.department ? 'Dept: ' + user.department : ''}\n\nThey will gain immediate access to the system.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: async () => {
            setActionId(user.id);
            try {
              await userService.approveUser(user.id);
              Alert.alert('Approved ✅', `${user.full_name} is now active.`);
              loadData();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to approve');
            } finally { setActionId(null); }
          }
        },
      ]
    );
  };

  const handleReject = (user) => {
    Alert.alert(
      'Reject Registration',
      `Are you sure you want to reject ${user.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: async () => {
            setActionId(user.id);
            try {
              await userService.rejectUser(user.id);
              Alert.alert('Rejected', 'Registration has been rejected.');
              loadData();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to reject');
            } finally { setActionId(null); }
          }
        },
      ]
    );
  };

  // Base URL imported

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Pending Registrations" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        <View style={styles.headerInfo}>
          <Ionicons name="people-circle" size={22} color={Colors.warning} />
          <Text style={styles.countText}>{users.length} registration{users.length !== 1 ? 's' : ''} awaiting review</Text>
        </View>

        {users.length === 0 ? (
          <EmptyState icon="happy-outline" title="Zero Pending!" message="All registration requests have been processed." />
        ) : (
          users.map((user) => (
            <Card key={user.id} style={styles.userCard} onPress={() => navigation.navigate('UserDetail', { userId: user.id })}>
              {/* Header row with photo and basic info */}
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  {user.profile_photo ? (
                    <Image source={{ uri: `${getBaseUrl()}${user.profile_photo}` }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Text style={styles.avatarInitial}>{user.full_name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.nameSection}>
                    <Text style={styles.userName}>{user.full_name}</Text>
                    <Text style={styles.userEmail}>{user.email}</Text>
                  </View>
                </View>
                <Badge text={user.role} variant={user.role === 'guard' ? 'secondary' : 'primary'} size="sm" />
              </View>

              {/* Details Grid */}
              <View style={styles.detailGrid}>
                <View style={styles.detailRow}>
                  <Ionicons name="business-outline" size={14} color={Colors.primary} />
                  <Text style={styles.detailLabel}>Org:</Text>
                  <Text style={styles.detailText}>{ORG_LABELS[user.organization] || user.organization}</Text>
                </View>
                {user.department && (
                  <View style={styles.detailRow}>
                    <Ionicons name="school-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.detailLabel}>Dept:</Text>
                    <Text style={styles.detailText}>{user.department}</Text>
                  </View>
                )}
                {user.designation && (
                  <View style={styles.detailRow}>
                    <Ionicons name="ribbon-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.detailLabel}>Desig:</Text>
                    <Text style={styles.detailText}>{user.designation}</Text>
                  </View>
                )}
                {user.gate_assigned && (
                  <View style={styles.detailRow}>
                    <Ionicons name="shield-outline" size={14} color={Colors.textMuted} />
                    <Text style={styles.detailLabel}>Gate:</Text>
                    <Text style={styles.detailText}>{user.gate_assigned}</Text>
                  </View>
                )}
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.detailLabel}>Phone:</Text>
                  <Text style={styles.detailText}>{user.phone}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
                  <Text style={styles.detailLabel}>Applied:</Text>
                  <Text style={styles.detailText}>{new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.actionSection}>
                <Button title="Approve" variant="success" size="sm" icon="checkmark" style={{ flex: 1 }} onPress={() => handleApprove(user)} loading={actionId === user.id} />
                <Button title="Reject" variant="danger" size="sm" icon="close" style={{ flex: 1, marginLeft: 10 }} onPress={() => handleReject(user)} loading={actionId === user.id} />
              </View>
            </Card>
          ))
        )}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 60 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.lg, paddingHorizontal: 4 },
  countText: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700' },

  userCard: { padding: Spacing.md, marginBottom: Spacing.lg, elevation: 4 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  userInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.surfaceLight },
  avatarPlaceholder: { width: 54, height: 54, borderRadius: 27, backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.primary + '30' },
  avatarInitial: { color: Colors.primary, fontSize: 22, fontWeight: '800' },
  nameSection: { flex: 1, marginLeft: Spacing.md },
  userName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  userEmail: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },

  detailGrid: { backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 6 },
  detailLabel: { color: Colors.textMuted, fontSize: 12, fontWeight: '700', width: 50 },
  detailText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '500', flex: 1 },

  actionSection: { flexDirection: 'row', marginTop: Spacing.xs },
});
