import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card, Badge, Header, EmptyState, LoadingScreen, Button, Input } from '../../components';
import { userService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function UserManagement({ navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: 'password123', role: 'guard', department: '', designation: '', gate_assigned: '' });
  const [creating, setCreating] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const params = filter !== 'all' ? { role: filter } : {};
      const res = await userService.getAll(params);
      setUsers(res.data?.data?.users || []);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleCreate = async () => {
    if (!form.full_name || !form.email) return Alert.alert('Error', 'Name and email required');
    setCreating(true);
    try {
      await userService.create(form);
      Alert.alert('Success', 'User created');
      setShowCreateForm(false);
      setForm({ full_name: '', email: '', phone: '', password: 'password123', role: 'guard', department: '', designation: '', gate_assigned: '' });
      loadData();
    } catch (e) { Alert.alert('Error', e.response?.data?.message || 'Failed'); }
    finally { setCreating(false); }
  };

  const handleDeactivate = (user) => {
    Alert.alert('Deactivate User', `Are you sure you want to deactivate ${user.full_name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Deactivate', style: 'destructive', onPress: async () => {
        try {
          await userService.delete(user.id);
          loadData();
        } catch (e) { Alert.alert('Error', 'Failed to deactivate'); }
      }},
    ]);
  };

  const roleColors = { guard: Colors.secondary, staff: Colors.primary, admin: Colors.warning };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="User Management" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />

      {/* Filters */}
      <View style={styles.filterRow}>
        {['all', 'guard', 'staff', 'admin'].map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && { color: Colors.text }]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}>

        {/* Create Form */}
        {showCreateForm && (
          <Card style={styles.createForm}>
            <Text style={styles.formTitle}>Create New User</Text>
            <Input label="Full Name *" placeholder="Enter name" value={form.full_name} onChangeText={t => setForm({ ...form, full_name: t })} />
            <Input label="Email *" placeholder="email@iiest.ac.in" value={form.email} onChangeText={t => setForm({ ...form, email: t })} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Phone" placeholder="Phone number" value={form.phone} onChangeText={t => setForm({ ...form, phone: t })} keyboardType="phone-pad" />
            <Input label="Password" placeholder="Default: password123" value={form.password} onChangeText={t => setForm({ ...form, password: t })} />
            <Text style={styles.inputLabel}>Role</Text>
            <View style={styles.roleRow}>
              {['guard', 'staff', 'admin'].map((r) => (
                <TouchableOpacity key={r} style={[styles.roleChip, form.role === r && { backgroundColor: roleColors[r] + '20', borderColor: roleColors[r] }]}
                  onPress={() => setForm({ ...form, role: r })}>
                  <Text style={[styles.roleText, form.role === r && { color: roleColors[r] }]}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {form.role === 'staff' && (
              <>
                <Input label="Department" placeholder="e.g. Computer Science" value={form.department} onChangeText={t => setForm({ ...form, department: t })} />
                <Input label="Designation" placeholder="e.g. Professor" value={form.designation} onChangeText={t => setForm({ ...form, designation: t })} />
              </>
            )}
            {form.role === 'guard' && (
              <Input label="Gate Assigned" placeholder="e.g. Main Gate" value={form.gate_assigned} onChangeText={t => setForm({ ...form, gate_assigned: t })} />
            )}
            <View style={styles.formActions}>
              <Button title="Create" variant="success" onPress={handleCreate} loading={creating} style={{ flex: 1, marginRight: 8 }} />
              <Button title="Cancel" variant="outline" onPress={() => setShowCreateForm(false)} style={{ flex: 1 }} />
            </View>
          </Card>
        )}

        {/* User List */}
        <Text style={styles.sectionTitle}>{users.length} Users</Text>
        {users.map((u) => (
          <Card key={u.id} onPress={() => navigation.navigate('UserDetail', { userId: u.id })}>
            <View style={styles.userRow}>
              <View style={[styles.roleIcon, { backgroundColor: (roleColors[u.role] || Colors.primary) + '15' }]}>
                <Ionicons name={u.role === 'guard' ? 'shield' : u.role === 'staff' ? 'school' : 'settings'} size={20}
                  color={roleColors[u.role] || Colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: Spacing.md }}>
                <Text style={styles.userName}>{u.full_name}</Text>
                <Text style={styles.userEmail}>{u.email}</Text>
                {u.department && <Text style={styles.userDept}>{u.department} • {u.designation}</Text>}
                {u.gate_assigned && <Text style={styles.userDept}>🚪 {u.gate_assigned}</Text>}
              </View>
              <View style={styles.userActions}>
                <Badge text={u.role} variant={u.role === 'guard' ? 'info' : u.role === 'staff' ? 'primary' : 'warning'} size="sm" />
                {!u.is_active && <Badge text="Inactive" variant="danger" size="sm" />}
                {u.is_active && u.role !== 'admin' && (
                  <TouchableOpacity onPress={() => handleDeactivate(u)} style={{ marginTop: 4 }}>
                    <Ionicons name="trash-outline" size={18} color={Colors.danger} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>

      {/* FAB */}
      {!showCreateForm && (
        <TouchableOpacity style={styles.fab} onPress={() => setShowCreateForm(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color={Colors.text} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 100 },

  filterRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border,
  },
  filterActive: { backgroundColor: Colors.primary + '20', borderColor: Colors.primary },
  filterText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },

  sectionTitle: {
    color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700',
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },

  createForm: { padding: Spacing.lg, marginBottom: Spacing.base },
  formTitle: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '800', marginBottom: Spacing.lg },
  inputLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.xs },
  roleRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.base },
  roleChip: {
    flex: 1, alignItems: 'center', paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceLight, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border,
  },
  roleText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  formActions: { flexDirection: 'row', marginTop: Spacing.base },

  userRow: { flexDirection: 'row', alignItems: 'center' },
  roleIcon: {
    width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center',
  },
  userName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  userEmail: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  userDept: { color: Colors.textMuted, fontSize: FontSizes.xs, marginTop: 2 },
  userActions: { alignItems: 'flex-end' },

  fab: {
    position: 'absolute', bottom: 24, right: 24,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 8, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
  },
});
