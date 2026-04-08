import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Badge, Button, LoadingScreen } from '../../components';
import { userService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';
import { resolvePhotoUrl } from '../../utils/photoUrl';




const ORG_LABELS = { iiest: 'IIEST', bank: 'Bank', school: 'School', iti: 'ITI', other: 'Other' };

export default function UserDetailScreen({ navigation, route }) {
  const { userId } = route.params;
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const res = await userService.getById(userId);
      setUser(res.data?.data?.user);
    } catch (e) {
      Alert.alert('Error', 'Failed to load user');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  // Base URL imported

  const handleDeactivate = () => {
    Alert.alert('Deactivate User', `Are you sure you want to deactivate ${user.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        try {
          await userService.delete(user.id);
          Alert.alert('Done', 'User deactivated');
          navigation.goBack();
        } catch (e) { Alert.alert('Error', 'Failed'); }
      }},
    ]);
  };

  const handleApprove = async () => {
    try {
      await userService.approveUser(user.id);
      Alert.alert('Done', 'User approved');
      loadUser();
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
  };

  const getRoleIcon = (role) => {
    const map = { guard: 'shield', staff: 'school', admin: 'settings' };
    return map[role] || 'person';
  };
  const getRoleColor = (role) => {
    const map = { guard: Colors.secondary, staff: Colors.primary, admin: Colors.warning };
    return map[role] || Colors.primary;
  };

  if (loading) return <LoadingScreen />;
  if (!user) return null;

  return (
    <View style={styles.container}>
      <Header title="User Details" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {user.profile_photo ? (
            <Image source={{ uri: resolvePhotoUrl(user.profile_photo) }} style={styles.profilePhoto} />
          ) : (
            <View style={[styles.avatarCircle, { backgroundColor: getRoleColor(user.role) + '20' }]}>
              <Text style={[styles.avatarText, { color: getRoleColor(user.role) }]}>
                {user.full_name.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.profileName}>{user.full_name}</Text>
          <View style={styles.badgeRow}>
            <Badge text={user.role} variant={user.role === 'guard' ? 'info' : user.role === 'staff' ? 'primary' : 'warning'} />
            {!user.is_active && <Badge text="Inactive" variant="danger" />}
            {!user.is_approved && user.is_active && <Badge text="Pending Approval" variant="warning" />}
            {user.is_approved && user.is_active && <Badge text="Active" variant="success" />}
          </View>
        </View>

        {/* Contact Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <DetailRow icon="mail" label="Email" value={user.email} />
          <DetailRow icon="call" label="Phone" value={user.phone || 'Not provided'} />
        </Card>

        {/* Organization */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Organization Details</Text>
          <DetailRow icon="business" label="Organization" value={ORG_LABELS[user.organization] || user.organization || '-'} />
          {user.department && <DetailRow icon="school" label="Department" value={user.department} />}
          {user.designation && <DetailRow icon="ribbon" label="Designation" value={user.designation} />}
          {user.employee_id && <DetailRow icon="id-card" label="Employee ID" value={user.employee_id} />}
          {user.gate_assigned && <DetailRow icon="location" label="Gate Assigned" value={user.gate_assigned} />}
        </Card>

        {/* Account Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Account Status</Text>
          <DetailRow icon="checkmark-circle" label="Approved" value={user.is_approved ? 'Yes' : 'No'} />
          <DetailRow icon="power" label="Active" value={user.is_active ? 'Yes' : 'No'} />
          <DetailRow icon="calendar" label="Registered" value={new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
        </Card>

        {/* Actions */}
        <View style={styles.actionSection}>
          {!user.is_approved && user.is_active && (
            <Button title="Approve User" icon="checkmark" variant="success" onPress={handleApprove}
              style={{ marginBottom: Spacing.sm }} />
          )}
          {user.is_active && user.role !== 'admin' && (
            <Button title="Deactivate User" icon="power" variant="danger" onPress={handleDeactivate} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={16} color={Colors.textMuted} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  profileHeader: { alignItems: 'center', marginBottom: Spacing.xl, paddingVertical: Spacing.lg },
  profilePhoto: { width: 100, height: 100, borderRadius: 50, marginBottom: Spacing.md },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { fontSize: 40, fontWeight: '900' },
  profileName: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '900', marginBottom: Spacing.sm },
  badgeRow: { flexDirection: 'row', gap: Spacing.sm },

  section: { padding: Spacing.lg, marginBottom: Spacing.md },
  sectionTitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  detailLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600', width: 100 },
  detailValue: { color: Colors.text, fontSize: FontSizes.base, flex: 1 },

  actionSection: { marginTop: Spacing.md },
});
