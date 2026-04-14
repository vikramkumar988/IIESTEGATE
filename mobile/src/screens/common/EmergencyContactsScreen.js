import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header } from '../../components';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../../theme';

const CONTACTS = [
  {
    id: 'security', name: 'Campus Security Control Room', phone: '9000000001',
    icon: 'shield', color: '#7C5CFC', desc: '24/7 Security Operations',
  },
  {
    id: 'police', name: 'Local Police Station', phone: '100',
    icon: 'car', color: '#3b82f6', desc: 'Howrah Police Station',
  },
  {
    id: 'fire', name: 'Fire Station', phone: '101',
    icon: 'flame', color: '#f97316', desc: 'Fire & Rescue Services',
  },
  {
    id: 'ambulance', name: 'Medical Emergency', phone: '108',
    icon: 'medkit', color: '#ef4444', desc: 'Ambulance & Hospital',
  },
  {
    id: 'admin', name: 'Campus Admin Office', phone: '9000000002',
    icon: 'business', color: '#22c55e', desc: 'Administrative Office',
  },
  {
    id: 'women', name: 'Women Helpline', phone: '1091',
    icon: 'people', color: '#ec4899', desc: 'Women Safety Helpline',
  },
  {
    id: 'disaster', name: 'Disaster Management', phone: '1078',
    icon: 'warning', color: '#f59e0b', desc: 'National Disaster Response',
  },
];

export default function EmergencyContactsScreen({ navigation }) {
  const handleCall = (contact) => {
    Alert.alert(
      `Call ${contact.name}?`,
      `Phone: ${contact.phone}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: '📞 Call Now', onPress: () => Linking.openURL(`tel:${contact.phone}`) },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header title="Emergency" subtitle="Quick Contacts" showBack onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* SOS Banner */}
        <View style={styles.sosBanner}>
          <View style={styles.sosIconWrap}>
            <Ionicons name="call" size={28} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sosTitle}>Emergency? Tap to call</Text>
            <Text style={styles.sosSubtitle}>Quick-dial important contacts below</Text>
          </View>
        </View>

        {CONTACTS.map((contact) => (
          <TouchableOpacity
            key={contact.id}
            style={styles.contactCard}
            onPress={() => handleCall(contact)}
            activeOpacity={0.7}
          >
            <View style={[styles.contactIcon, { backgroundColor: contact.color + '12' }]}>
              <Ionicons name={contact.icon} size={24} color={contact.color} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactName}>{contact.name}</Text>
              <Text style={styles.contactDesc}>{contact.desc}</Text>
              <Text style={styles.contactPhone}>{contact.phone}</Text>
            </View>
            <View style={[styles.callBtn, { backgroundColor: contact.color + '15', borderColor: contact.color + '30' }]}>
              <Ionicons name="call" size={20} color={contact.color} />
            </View>
          </TouchableOpacity>
        ))}

        <Text style={styles.footerNote}>
          ⚠️ Phone numbers are placeholders. Contact your campus admin to configure actual numbers.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.lg },
  sosBanner: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#ef444415', borderWidth: 1.5, borderColor: '#ef444430', borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.xl },
  sosIconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  sosTitle: { color: '#ef4444', fontSize: FontSizes.lg, fontWeight: '900' },
  sosSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: 10, borderWidth: 1, borderColor: Colors.border, gap: 14 },
  contactIcon: { width: 50, height: 50, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  contactInfo: { flex: 1 },
  contactName: { color: Colors.text, fontSize: FontSizes.base, fontWeight: '800' },
  contactDesc: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  contactPhone: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700', marginTop: 4, fontFamily: 'monospace' },
  callBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5 },
  footerNote: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: Spacing.xl, fontStyle: 'italic', paddingHorizontal: Spacing.xl, lineHeight: 16 },
});
