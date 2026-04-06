import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, Image, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Button, Header, Badge } from '../../components';
import { gatePassService, getBaseUrl } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const SCAN_MODES = [
  { key: 'entry', label: 'Entry', icon: 'log-in-outline', color: Colors.success },
  { key: 'exit', label: 'Exit', icon: 'log-out-outline', color: Colors.warning },
  { key: 'verify', label: 'Verify', icon: 'search-outline', color: Colors.primary },
];

export default function ScanQR({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState(null);
  const [scanMode, setScanMode] = useState('entry');

  const handleBarCodeScanned = async ({ type, data }) => {
    if (scanned || verifying) return;
    setScanned(true);
    setVerifying(true);

    try {
      let passCode = data;
      try {
        const parsed = JSON.parse(data);
        passCode = parsed.pass_code || data;
      } catch (e) { /* raw string is fine */ }

      const res = await gatePassService.verify({
        pass_code: passCode,
        scan_mode: scanMode,
        location: 'Gate Scan',
      });
      setResult(res.data?.data);
    } catch (error) {
      try {
        const res = await gatePassService.verify({
          pass_code: data,
          scan_mode: scanMode,
          location: 'Gate Scan',
        });
        setResult(res.data?.data);
      } catch (e) {
        setResult({ status: 'invalid', pass: null, visit: null });
      }
    } finally {
      setVerifying(false);
    }
  };

  const resetScanner = () => {
    setScanned(false);
    setResult(null);
  };

  if (!permission) return <View style={styles.container} />;
  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Header title="Scan QR" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={64} color={Colors.textMuted} />
          <Text style={styles.permText}>Camera permission required</Text>
          <Button title="Grant Permission" onPress={requestPermission} style={{ marginTop: Spacing.lg }} />
        </View>
      </View>
    );
  }

  // ===== LOCKDOWN RESULT =====
  if (result?.status === 'lockdown') {
    return (
      <View style={[styles.container, { backgroundColor: '#1a0000' }]}>
        <Header title="⚠️ LOCKDOWN" leftIcon="arrow-back" onLeftPress={resetScanner} />
        <View style={styles.resultContainer}>
          <View style={[styles.resultBadge, { backgroundColor: '#8B000030', borderColor: '#8B0000' }]}>  
            <Ionicons name="lock-closed" size={72} color="#FF3333" />
            <Text style={[styles.resultStatus, { color: '#FF3333' }]}>CAMPUS LOCKDOWN</Text>
          </View>
          <View style={styles.resultCard}>
            <Text style={[styles.resultDetail, { color: '#FF6666', fontWeight: '700', fontSize: FontSizes.lg, textAlign: 'center' }]}>
              All entry and exit is SUSPENDED
            </Text>
            <Text style={[styles.resultDetail, { marginTop: Spacing.md }]}>
              📋 Reason: {result.lockdown_reason}
            </Text>
            <Text style={styles.resultDetail}>
              🕐 Since: {new Date(result.lockdown_since).toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.resultActions}>
            <Button title="Go Back" icon="arrow-back" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    );
  }

  // ===== BLACKLISTED RESULT =====
  if (result?.status === 'blacklisted') {
    return (
      <View style={[styles.container, { backgroundColor: '#1a000010' }]}>
        <Header title="⛔ BLOCKED" leftIcon="arrow-back" onLeftPress={resetScanner} />
        <View style={styles.resultContainer}>
          <View style={[styles.resultBadge, { backgroundColor: Colors.danger + '20', borderColor: Colors.danger }]}>
            <Ionicons name="hand-left" size={72} color={Colors.danger} />
            <Text style={[styles.resultStatus, { color: Colors.danger }]}>BLACKLISTED</Text>
          </View>
          <View style={styles.resultCard}>
            {result.pass?.visitor_photo && (
              <Image source={{ uri: result.pass.visitor_photo.startsWith('http') ? result.pass.visitor_photo : `${getBaseUrl()}${result.pass.visitor_photo}` }} style={styles.resultPhoto} />
            )}
            <Text style={styles.resultName}>{result.pass?.visitor_name || 'Unknown'}</Text>
            <Text style={styles.resultDetail}>📱 {result.pass?.visitor_phone}</Text>
            <View style={styles.warningBox}>
              <Ionicons name="warning" size={18} color={Colors.danger} />
              <Text style={[styles.warningText, { color: Colors.danger }]}>
                {result.blacklist_reason}
              </Text>
            </View>
          </View>
          <View style={styles.resultActions}>
            <Button title="Scan Another" icon="qr-code" onPress={resetScanner} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Go Back" icon="arrow-back" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          </View>
        </View>
      </View>
    );
  }

  // ===== NORMAL RESULT (valid / expired / revoked / invalid / used) =====
  if (result) {
    const isValid = result.status === 'valid';
    const isUsed = result.status === 'used';
    const bgColor = isValid ? Colors.success : isUsed ? Colors.primary : Colors.danger;
    const icon = isValid ? 'checkmark-circle' : isUsed ? 'checkmark-done-circle' : 'close-circle';

    let statusText;
    switch (result.status) {
      case 'valid': statusText = 'VALID PASS'; break;
      case 'expired': statusText = 'PASS EXPIRED'; break;
      case 'revoked': statusText = 'PASS REVOKED'; break;
      case 'used': statusText = 'PASS USED (EXITED)'; break;
      default: statusText = 'INVALID QR CODE';
    }

    // Scan action messages
    let actionMessage = null;
    let actionColor = Colors.textSecondary;
    switch (result.scan_action) {
      case 'entry_recorded':
        actionMessage = '✅ Entry recorded successfully!';
        actionColor = Colors.success;
        break;
      case 'exit_recorded':
        actionMessage = `✅ Exit recorded! Duration: ${result.duration}`;
        actionColor = Colors.success;
        break;
      case 'already_entered':
        actionMessage = '⚠️ Visitor already entered — entry was previously recorded';
        actionColor = Colors.warning;
        break;
      case 'already_exited':
        actionMessage = '⚠️ Visitor already exited';
        actionColor = Colors.warning;
        break;
      case 'no_entry_record':
        actionMessage = '⚠️ No entry record found for this pass!';
        actionColor = Colors.danger;
        break;
    }

    return (
      <View style={[styles.container, { backgroundColor: bgColor + '10' }]}>
        <Header title="Verification Result" leftIcon="arrow-back" onLeftPress={resetScanner} />
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <View style={[styles.resultBadge, { backgroundColor: bgColor + '20', borderColor: bgColor }]}>
            <Ionicons name={icon} size={72} color={bgColor} />
            <Text style={[styles.resultStatus, { color: bgColor }]}>{statusText}</Text>
          </View>

          {/* Gate mismatch warning */}
          {result.gate_mismatch && (
            <View style={styles.gateMismatchBanner}>
              <Ionicons name="warning" size={20} color="#f59e0b" />
              <Text style={styles.gateMismatchText}>{result.gate_warning}</Text>
            </View>
          )}

          {/* Scan action banner */}
          {actionMessage && (
            <View style={[styles.actionBanner, { borderColor: actionColor + '40', backgroundColor: actionColor + '10' }]}>
              <Text style={[styles.actionBannerText, { color: actionColor }]}>{actionMessage}</Text>
            </View>
          )}

          {result.pass && (
            <View style={styles.resultCard}>
              {result.pass.visitor_photo && (
                <Image source={{ uri: result.pass.visitor_photo.startsWith('http') ? result.pass.visitor_photo : `${getBaseUrl()}${result.pass.visitor_photo}` }} style={styles.resultPhoto} />
              )}
              <Text style={styles.resultName}>{result.pass.visitor_name}</Text>
              <Text style={styles.resultDetail}>📱 {result.pass.visitor_phone}</Text>
              {result.visit?.purpose && <Text style={styles.resultDetail}>📋 {result.visit.purpose}</Text>}
              {result.visit?.staff_name && <Text style={styles.resultDetail}>🎓 Visiting: {result.visit.staff_name}</Text>}
              {result.visit?.department && <Text style={styles.resultDetail}>🏢 {result.visit.department}</Text>}
              {result.visit?.vehicle_number && (
                <Text style={styles.resultDetail}>🚗 Vehicle: {result.visit.vehicle_type} — {result.visit.vehicle_number}</Text>
              )}
              <Text style={styles.resultDetail}>⏰ Valid until: {new Date(result.pass.valid_until).toLocaleString('en-IN')}</Text>
              {result.pass.entry_time && (
                <Text style={styles.resultDetail}>🚪 Entered: {new Date(result.pass.entry_time).toLocaleTimeString('en-IN')}</Text>
              )}
              {result.pass.exit_time && (
                <Text style={styles.resultDetail}>🚶 Exited: {new Date(result.pass.exit_time).toLocaleTimeString('en-IN')}</Text>
              )}
              {result.duration && (
                <Text style={[styles.resultDetail, { fontWeight: '700', color: Colors.text }]}>⏱️ Duration on campus: {result.duration}</Text>
              )}

              {/* Meeting status for professor visits */}
              {result.visit?.visit_type === 'professor_visit' && result.visit?.meeting_status && (
                <View style={[styles.meetingRow,
                  result.visit.meeting_status === 'met' ? styles.meetingMet :
                  result.visit.meeting_status === 'not_met' ? styles.meetingNotMet :
                  styles.meetingPending
                ]}>
                  <Ionicons
                    name={result.visit.meeting_status === 'met' ? 'checkmark-circle' : result.visit.meeting_status === 'not_met' ? 'close-circle' : 'help-circle-outline'}
                    size={18}
                    color={result.visit.meeting_status === 'met' ? '#22c55e' : result.visit.meeting_status === 'not_met' ? '#ef4444' : '#f59e0b'}
                  />
                  <Text style={[styles.meetingText, {
                    color: result.visit.meeting_status === 'met' ? '#22c55e' : result.visit.meeting_status === 'not_met' ? '#ef4444' : '#f59e0b'
                  }]}>
                    {result.visit.meeting_status === 'met' ? 'Staff confirmed meeting ✅' :
                     result.visit.meeting_status === 'not_met' ? 'Staff: visitor did NOT meet them ❌' :
                     'Meeting not yet confirmed by staff'}
                  </Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.resultActions}>
            <Button title="Scan Another" icon="qr-code" onPress={resetScanner} style={{ flex: 1, marginRight: 8 }} />
            <Button title="Go Back" icon="arrow-back" variant="outline" onPress={() => navigation.goBack()} style={{ flex: 1 }} />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ===== SCANNER VIEW =====
  return (
    <View style={styles.container}>
      <Header title="Scan QR Code" leftIcon="arrow-back" onLeftPress={() => navigation.goBack()} />

      {/* Scan Mode Toggle */}
      <View style={styles.modeRow}>
        {SCAN_MODES.map((mode) => (
          <TouchableOpacity
            key={mode.key}
            style={[styles.modeBtn, scanMode === mode.key && { backgroundColor: mode.color + '20', borderColor: mode.color }]}
            onPress={() => setScanMode(mode.key)}
          >
            <Ionicons name={mode.icon} size={18} color={scanMode === mode.key ? mode.color : Colors.textMuted} />
            <Text style={[styles.modeBtnText, scanMode === mode.key && { color: mode.color }]}>{mode.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        >
          <View style={styles.overlay}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft, { borderColor: SCAN_MODES.find(m => m.key === scanMode)?.color || Colors.primary }]} />
              <View style={[styles.corner, styles.topRight, { borderColor: SCAN_MODES.find(m => m.key === scanMode)?.color || Colors.primary }]} />
              <View style={[styles.corner, styles.bottomLeft, { borderColor: SCAN_MODES.find(m => m.key === scanMode)?.color || Colors.primary }]} />
              <View style={[styles.corner, styles.bottomRight, { borderColor: SCAN_MODES.find(m => m.key === scanMode)?.color || Colors.primary }]} />
            </View>
            <Text style={styles.scanText}>
              {verifying ? 'Verifying...' : scanMode === 'entry' ? 'Scan for ENTRY' : scanMode === 'exit' ? 'Scan for EXIT' : 'Scan to VERIFY'}
            </Text>
          </View>
        </CameraView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  permText: { color: Colors.textSecondary, fontSize: FontSizes.lg, marginTop: Spacing.base },

  // Scan mode toggle
  modeRow: { flexDirection: 'row', paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm, gap: Spacing.sm },
  modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  modeBtnText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },

  cameraContainer: { flex: 1 },
  camera: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanFrame: { width: 260, height: 260, position: 'relative' },
  corner: { position: 'absolute', width: 40, height: 40  },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 12 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 12 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 12 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 12 },
  scanText: { color: Colors.text, fontSize: FontSizes.md, marginTop: Spacing.xl, fontWeight: '700' },

  resultContainer: { flexGrow: 1, padding: Spacing.lg, alignItems: 'center' },
  resultBadge: { alignItems: 'center', padding: Spacing.xxl, borderRadius: BorderRadius.xl, borderWidth: 2, width: '100%', marginBottom: Spacing.md },
  resultStatus: { fontSize: FontSizes.xxl, fontWeight: '900', marginTop: Spacing.sm, letterSpacing: 2 },

  gateMismatchBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f59e0b15', borderWidth: 1, borderColor: '#f59e0b40', borderRadius: BorderRadius.md, padding: Spacing.md, width: '100%', marginBottom: Spacing.sm },
  gateMismatchText: { color: '#f59e0b', fontSize: FontSizes.sm, fontWeight: '700', flex: 1 },

  actionBanner: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, width: '100%', marginBottom: Spacing.md, alignItems: 'center' },
  actionBannerText: { fontSize: FontSizes.sm, fontWeight: '700' },

  resultCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  resultPhoto: { width: 100, height: 130, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  resultName: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '800', marginBottom: Spacing.sm },
  resultDetail: { color: Colors.textSecondary, fontSize: FontSizes.md, marginBottom: 4, alignSelf: 'flex-start' },
  resultActions: { flexDirection: 'row', marginTop: Spacing.lg, width: '100%' },

  warningBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.danger + '10', borderRadius: BorderRadius.md, width: '100%' },
  warningText: { fontSize: FontSizes.sm, fontWeight: '600', flex: 1 },

  meetingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm, padding: Spacing.sm, borderRadius: BorderRadius.sm, width: '100%', alignSelf: 'flex-start' },
  meetingMet: { backgroundColor: 'rgba(34,197,94,0.1)' },
  meetingNotMet: { backgroundColor: 'rgba(239,68,68,0.1)' },
  meetingPending: { backgroundColor: 'rgba(245,158,11,0.1)' },
  meetingText: { fontSize: FontSizes.sm, fontWeight: '600', flex: 1 },
});
