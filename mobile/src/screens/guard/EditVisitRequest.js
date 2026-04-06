import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Input, Button, LoadingScreen } from '../../components';
import { visitService, userService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function EditVisitRequest({ navigation, route }) {
  const { requestId } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState(null);
  const [form, setForm] = useState({ visitor_name: '', visitor_phone: '', purpose: '', notes: '', staff_id: '' });
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffPicker, setShowStaffPicker] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    loadRequest();
  }, []);

  const loadRequest = async () => {
    try {
      const res = await visitService.getById(requestId);
      const req = res.data.data.visit_request;
      setRequest(req);
      setForm({
        visitor_name: req.visitor_name || '',
        visitor_phone: req.visitor_phone || '',
        purpose: req.purpose || '',
        notes: req.notes || '',
        staff_id: req.staff_id || '',
      });
      setSelectedStaff({ id: req.staff_id, full_name: req.staff_name, department: req.staff_department });
    } catch (e) {
      Alert.alert('Error', 'Failed to load request');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const searchStaff = async (text) => {
    setStaffSearch(text);
    if (text.length < 2) { setStaffList([]); return; }
    try {
      const res = await userService.searchStaff({ search: text });
      setStaffList(res.data.data.staff || []);
    } catch (e) { console.log(e); }
  };

  const selectStaff = (staff) => {
    setSelectedStaff(staff);
    setForm(prev => ({ ...prev, staff_id: staff.id }));
    setShowStaffPicker(false);
    setStaffSearch('');
    setStaffList([]);
  };

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!form.visitor_name.trim() || !form.purpose.trim()) {
      Alert.alert('Error', 'Visitor name and purpose are required');
      return;
    }
    setSaving(true);
    try {
      await visitService.edit(requestId, {
        visitor_name: form.visitor_name.trim(),
        visitor_phone: form.visitor_phone.trim(),
        purpose: form.purpose.trim(),
        notes: form.notes.trim(),
        staff_id: form.staff_id,
      });
      Alert.alert('Success ✅', 'Request updated successfully');
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Request',
      'Are you sure you want to delete this pending request? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            setSaving(true);
            try {
              await visitService.cancel(requestId, { reason: 'Deleted by guard during edit' });
              Alert.alert('Deleted', 'The visit request has been removed');
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to delete');
            } finally {
              setSaving(false);
            }
          }
        },
      ]
    );
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Edit Request" showBack onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={20} color={Colors.primary} />
          <Text style={styles.infoText}>You can only edit pending requests</Text>
        </View>

        <Input label="Visitor Name" icon="person-outline" value={form.visitor_name} onChangeText={(v) => updateForm('visitor_name', v)} />
        <Input label="Visitor Phone" icon="call-outline" value={form.visitor_phone} onChangeText={(v) => updateForm('visitor_phone', v)} keyboardType="phone-pad" />
        <Input label="Purpose" icon="document-text-outline" value={form.purpose} onChangeText={(v) => updateForm('purpose', v)} multiline />
        <Input label="Notes" icon="create-outline" value={form.notes} onChangeText={(v) => updateForm('notes', v)} multiline />

        {/* Staff Selection */}
        <Text style={styles.label}>Assigned Staff</Text>
        {selectedStaff && (
          <View style={styles.selectedStaff}>
            <View style={{ flex: 1 }}>
              <Text style={styles.staffName}>{selectedStaff.full_name}</Text>
              <Text style={styles.staffDept}>{selectedStaff.department || ''}</Text>
            </View>
            <TouchableOpacity onPress={() => setShowStaffPicker(true)}>
              <Ionicons name="swap-horizontal" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {showStaffPicker && (
          <View style={styles.staffPicker}>
            <Input placeholder="Search staff..." value={staffSearch} onChangeText={searchStaff} icon="search-outline" />
            {staffList.map((s) => (
              <TouchableOpacity key={s.id} style={styles.staffItem} onPress={() => selectStaff(s)}>
                <Text style={styles.staffItemName}>{s.full_name}</Text>
                <Text style={styles.staffItemDept}>{s.department} • {s.designation}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Button title="Save Changes" onPress={handleSave} loading={saving} icon="checkmark" style={{ marginTop: Spacing.xl }} />
        
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete} disabled={saving}>
          <Ionicons name="trash-outline" size={18} color={Colors.danger} />
          <Text style={styles.deleteBtnText}>Delete This Request</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.base, paddingBottom: 60 },
  infoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary + '15', borderRadius: BorderRadius.base, padding: Spacing.md, marginBottom: Spacing.lg, gap: Spacing.sm },
  infoText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },
  label: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', marginBottom: Spacing.sm, marginTop: Spacing.md, textTransform: 'uppercase', letterSpacing: 1 },
  selectedStaff: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.base, borderWidth: 1, borderColor: Colors.border },
  staffName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '700' },
  staffDept: { color: Colors.textMuted, fontSize: FontSizes.sm },
  staffPicker: { backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  staffItem: { paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border },
  staffItemName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600' },
  staffItemDept: { color: Colors.textMuted, fontSize: FontSizes.sm },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xl, gap: 8, padding: Spacing.md },
  deleteBtnText: { color: Colors.danger, fontSize: FontSizes.sm, fontWeight: '700', textTransform: 'uppercase' },
});
