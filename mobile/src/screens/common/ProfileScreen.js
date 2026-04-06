import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { Header, Button, Input, Card, Badge, Avatar } from '../../components';
import { authService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwords, setPasswords] = useState({ current: '', new_pass: '', confirm: '' });
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!passwords.current || !passwords.new_pass) return Alert.alert('Error', 'All fields required');
    if (passwords.new_pass !== passwords.confirm) return Alert.alert('Error', 'Passwords do not match');
    if (passwords.new_pass.length < 6) return Alert.alert('Error', 'Password must be at least 6 characters');

    setChanging(true);
    try {
      await authService.changePassword({ current_password: passwords.current, new_password: passwords.new_pass });
      Alert.alert('Success', 'Password changed successfully');
      setShowChangePassword(false);
      setPasswords({ current: '', new_pass: '', confirm: '' });
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setChanging(false); }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  const roleLabel = { guard: '🛡️ Security Guard', staff: '🎓 Professor / Staff', admin: '⚙️ Administrator' };

  return (
    <View style={styles.container}>
      <Header title="Profile" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <Avatar name={user?.full_name} size={80} />
          <Text style={styles.name}>{user?.full_name}</Text>
          <Badge text={user?.role || 'User'} variant={user?.role === 'admin' ? 'warning' : user?.role === 'guard' ? 'info' : 'primary'} />
          <Text style={styles.roleDesc}>{roleLabel[user?.role] || 'User'}</Text>
        </Card>

        {/* Details */}
        <Card>
          <View style={styles.detailRow}>
            <Ionicons name="mail" size={20} color={Colors.textMuted} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{user?.email}</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="call" size={20} color={Colors.textMuted} />
            <View style={styles.detailInfo}>
              <Text style={styles.detailLabel}>Phone</Text>
              <Text style={styles.detailValue}>{user?.phone || 'Not set'}</Text>
            </View>
          </View>
          {user?.department && (
            <View style={styles.detailRow}>
              <Ionicons name="school" size={20} color={Colors.textMuted} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Department</Text>
                <Text style={styles.detailValue}>{user.department}</Text>
              </View>
            </View>
          )}
          {user?.designation && (
            <View style={styles.detailRow}>
              <Ionicons name="ribbon" size={20} color={Colors.textMuted} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Designation</Text>
                <Text style={styles.detailValue}>{user.designation}</Text>
              </View>
            </View>
          )}
          {user?.gate_assigned && (
            <View style={styles.detailRow}>
              <Ionicons name="location" size={20} color={Colors.textMuted} />
              <View style={styles.detailInfo}>
                <Text style={styles.detailLabel}>Gate Assigned</Text>
                <Text style={styles.detailValue}>{user.gate_assigned}</Text>
              </View>
            </View>
          )}
        </Card>

        {/* Change Password */}
        {showChangePassword ? (
          <Card>
            <Text style={styles.sectionTitle}>Change Password</Text>
            <Input label="Current Password" secureTextEntry placeholder="Enter current password"
              value={passwords.current} onChangeText={t => setPasswords({ ...passwords, current: t })} />
            <Input label="New Password" secureTextEntry placeholder="Enter new password"
              value={passwords.new_pass} onChangeText={t => setPasswords({ ...passwords, new_pass: t })} />
            <Input label="Confirm Password" secureTextEntry placeholder="Confirm new password"
              value={passwords.confirm} onChangeText={t => setPasswords({ ...passwords, confirm: t })} />
            <View style={styles.pwActions}>
              <Button title="Save" variant="success" onPress={handleChangePassword} loading={changing} style={{ flex: 1, marginRight: 8 }} />
              <Button title="Cancel" variant="outline" onPress={() => setShowChangePassword(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        ) : (
          <Button title="Change Password" icon="lock-closed" variant="outline"
            onPress={() => setShowChangePassword(true)} style={{ marginBottom: Spacing.md }} />
        )}

        <Button title="Logout" icon="log-out" variant="danger" onPress={handleLogout} size="lg"
          style={{ marginTop: Spacing.sm }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 40 },

  profileCard: { alignItems: 'center', padding: Spacing.xl },
  name: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '800', marginTop: Spacing.base, marginBottom: Spacing.sm },
  roleDesc: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.sm },

  detailRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailInfo: { marginLeft: Spacing.md, flex: 1 },
  detailLabel: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '600' },
  detailValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600', marginTop: 2 },

  sectionTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '700', marginBottom: Spacing.base },
  pwActions: { flexDirection: 'row', marginTop: Spacing.base },
});
