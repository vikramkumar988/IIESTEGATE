import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { Header, Button } from '../../components';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function GenerateQR({ route, navigation }) {
  const { pass } = route.params || {};

  if (!pass) {
    return (
      <View style={styles.container}>
        <Header title="QR Pass" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Text style={styles.errorText}>No pass data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Header title="Gate Pass" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.passCard}>
          <View style={styles.passHeader}>
            <Text style={styles.passTitle}>IIEST E-Gate Pass</Text>
            <Text style={styles.passSubtitle}>Campus Entry Authorization</Text>
          </View>

          {pass.qr_data && (
            <View style={styles.qrContainer}>
              <Image source={{ uri: pass.qr_data }} style={styles.qrImage} resizeMode="contain" />
            </View>
          )}

          <Text style={styles.passCode}>{pass.pass_code}</Text>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: pass.status === 'active' ? Colors.success + '20' : Colors.danger + '20' }]}>
              <Text style={[styles.statusText, { color: pass.status === 'active' ? Colors.success : Colors.danger }]}>
                {pass.status?.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Valid Until</Text>
            <Text style={styles.detailValue}>{new Date(pass.valid_until).toLocaleString('en-IN')}</Text>
          </View>

          {pass.entry_time && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Entry Time</Text>
              <Text style={styles.detailValue}>{new Date(pass.entry_time).toLocaleTimeString('en-IN')}</Text>
            </View>
          )}
        </View>

        <Button title="Done" icon="checkmark-circle" size="lg"
          onPress={() => navigation.popToTop()} style={{ marginTop: Spacing.lg }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { color: Colors.textMuted, fontSize: FontSizes.lg },
  content: { padding: Spacing.lg, alignItems: 'center' },

  passCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl, padding: Spacing.xl,
    width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  passHeader: { alignItems: 'center', marginBottom: Spacing.lg },
  passTitle: { color: Colors.primary, fontSize: FontSizes.xxl, fontWeight: '900', letterSpacing: 1 },
  passSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 4 },

  qrContainer: {
    backgroundColor: '#FFFFFF', borderRadius: BorderRadius.lg, padding: Spacing.base,
    marginBottom: Spacing.base,
  },
  qrImage: { width: 240, height: 240 },
  passCode: { color: Colors.textSecondary, fontSize: FontSizes.base, fontWeight: '800', letterSpacing: 3 },

  divider: { width: '100%', height: 1, backgroundColor: Colors.border, marginVertical: Spacing.lg },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    width: '100%', paddingVertical: Spacing.sm,
  },
  detailLabel: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  detailValue: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '600' },

  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: FontSizes.sm, fontWeight: '800', letterSpacing: 1 },
});
