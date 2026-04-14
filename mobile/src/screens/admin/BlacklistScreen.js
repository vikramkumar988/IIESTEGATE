import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Image, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Badge, LoadingScreen, EmptyState, Button } from '../../components';
import { userService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function BlacklistScreen({ navigation }) {
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  // Unblacklist modal
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const res = await userService.getBlacklistedVisitors();
      setVisitors(res.data?.data?.visitors || []);
    } catch (e) {
      console.log('Blacklist load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { const u = navigation.addListener('focus', loadData); return u; }, [navigation, loadData]);

  const handleRemove = async (visitor) => {
    Alert.alert(
      'Remove from Blacklist?',
      `Allow ${visitor.full_name} to visit campus again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive', onPress: async () => {
            try {
              await userService.unblacklistVisitor({ visitor_id: visitor.id });
              Alert.alert('✅ Removed', `${visitor.full_name} has been removed from the blacklist.`);
              loadData();
              setModalVisible(false);
            } catch (e) {
              Alert.alert('Error', e.response?.data?.message || 'Failed to remove');
            }
          }
        },
      ]
    );
  };

  const filtered = search.trim()
    ? visitors.filter(v =>
      v.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      v.phone?.includes(search)
    )
    : visitors;

  if (loading) return <LoadingScreen />;

  return (
    <View style={styles.container}>
      <Header title="Blacklist" subtitle={`${visitors.length} blacklisted`} showBack onBack={() => navigation.goBack()} />

      {/* Search */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={Colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />}
      >
        {/* Warning Banner */}
        <View style={styles.warningBanner}>
          <Ionicons name="warning" size={20} color="#ef4444" />
          <Text style={styles.warningText}>Blacklisted visitors are automatically blocked from entry. Guards receive alerts when they attempt to register.</Text>
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No Blacklisted Visitors" message={search ? 'No results match your search.' : 'No visitors are currently blacklisted.'} />
        ) : (
          filtered.map((visitor, idx) => (
            <TouchableOpacity
              key={`bl-${visitor.id}-${idx}`}
              style={styles.visitorCard}
              onPress={() => { setSelectedVisitor(visitor); setModalVisible(true); }}
              activeOpacity={0.7}
            >
              <View style={styles.avatarWrap}>
                <Ionicons name="ban" size={28} color="#ef4444" />
              </View>
              <View style={styles.visitorInfo}>
                <Text style={styles.visitorName}>{visitor.full_name}</Text>
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={11} color={Colors.textMuted} />
                  <Text style={styles.visitorMeta}>{visitor.phone}</Text>
                </View>
                {visitor.id_type && (
                  <View style={styles.metaRow}>
                    <Ionicons name="card-outline" size={11} color={Colors.textMuted} />
                    <Text style={styles.visitorMeta}>{visitor.id_type}: {visitor.id_number}</Text>
                  </View>
                )}
                <View style={styles.reasonBox}>
                  <Ionicons name="document-text-outline" size={11} color="#ef4444" />
                  <Text style={styles.reasonText} numberOfLines={2}>{visitor.blacklist_reason}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>

            {selectedVisitor && (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalBanIcon}>
                    <Ionicons name="ban" size={48} color="#ef4444" />
                  </View>
                  <Text style={styles.modalName}>{selectedVisitor.full_name}</Text>
                  <Badge text="BLACKLISTED" variant="danger" />
                </View>

                <View style={styles.modalInfoSection}>
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="call" size={16} color={Colors.textMuted} />
                    <Text style={styles.modalInfoLabel}>Phone</Text>
                    <Text style={styles.modalInfoValue}>{selectedVisitor.phone}</Text>
                  </View>
                  {selectedVisitor.id_type && (
                    <View style={styles.modalInfoRow}>
                      <Ionicons name="card" size={16} color={Colors.textMuted} />
                      <Text style={styles.modalInfoLabel}>ID</Text>
                      <Text style={styles.modalInfoValue}>{selectedVisitor.id_type}: {selectedVisitor.id_number}</Text>
                    </View>
                  )}
                  <View style={styles.modalInfoRow}>
                    <Ionicons name="calendar" size={16} color={Colors.textMuted} />
                    <Text style={styles.modalInfoLabel}>Added</Text>
                    <Text style={styles.modalInfoValue}>{new Date(selectedVisitor.created_at).toLocaleDateString('en-IN')}</Text>
                  </View>
                </View>

                <View style={styles.reasonSection}>
                  <Text style={styles.reasonSectionTitle}>Reason for Blacklisting</Text>
                  <Text style={styles.reasonSectionText}>{selectedVisitor.blacklist_reason}</Text>
                </View>

                <Button
                  title="Remove from Blacklist"
                  icon="shield-checkmark"
                  variant="danger"
                  size="lg"
                  onPress={() => handleRemove(selectedVisitor)}
                  style={{ marginTop: Spacing.lg }}
                />
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
  content: { padding: Spacing.lg },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md },
  searchInput: { flex: 1, paddingVertical: 12, color: Colors.text, fontSize: FontSizes.base },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#ef444410', borderWidth: 1, borderColor: '#ef444425', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  warningText: { color: Colors.textSecondary, fontSize: FontSizes.xs, flex: 1, lineHeight: 16 },
  visitorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: 10, borderWidth: 1, borderColor: '#ef444420', gap: 12 },
  avatarWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ef444410', justifyContent: 'center', alignItems: 'center' },
  visitorInfo: { flex: 1 },
  visitorName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  visitorMeta: { color: Colors.textMuted, fontSize: 11 },
  reasonBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 4, marginTop: 6, backgroundColor: '#ef444408', padding: 6, borderRadius: 6 },
  reasonText: { color: '#ef4444', fontSize: 10, flex: 1, fontStyle: 'italic' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalContainer: { backgroundColor: Colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '85%', paddingTop: 16 },
  modalCloseBtn: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: Colors.surface, borderRadius: 20, borderWidth: 1, borderColor: Colors.border },
  modalContent: { padding: Spacing.xl, paddingBottom: 40 },
  modalHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  modalBanIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ef444415', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  modalName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900', marginBottom: 8 },
  modalInfoSection: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  modalInfoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  modalInfoLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700', width: 60 },
  modalInfoValue: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '600', flex: 1 },
  reasonSection: { backgroundColor: '#ef444408', borderWidth: 1, borderColor: '#ef444420', borderRadius: BorderRadius.lg, padding: Spacing.lg },
  reasonSectionTitle: { color: '#ef4444', fontSize: FontSizes.sm, fontWeight: '800', marginBottom: 6 },
  reasonSectionText: { color: Colors.textSecondary, fontSize: FontSizes.base, lineHeight: 22 },
});
