import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authService } from '../../services/api';
import { Button, Input } from '../../components';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const STEPS = ['email', 'otp', 'newPassword'];

export default function ForgotPasswordScreen({ navigation }) {
  const [currentStep, setCurrentStep] = useState(0); // 0=email, 1=otp, 2=newPassword
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(progressAnim, { toValue: currentStep, useNativeDriver: false, tension: 50, friction: 8 }).start();
  }, [currentStep]);

  // Countdown timer
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const animateStep = (callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  // Step 1: Send OTP to email
  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await authService.sendForgotPasswordOTP({ email: email.trim().toLowerCase() });
      setOtpCountdown(60);
      setSuccessMessage('OTP sent to your email!');
      animateStep(() => setCurrentStep(1));
      setTimeout(() => otpRefs[0]?.current?.focus(), 400);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = () => {
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      setError('Please enter the complete 4-digit OTP');
      return;
    }
    setError('');
    setSuccessMessage('OTP verified! Set your new password.');
    animateStep(() => setCurrentStep(2));
  };

  // Step 3: Reset password
  const handleResetPassword = async () => {
    if (!newPassword.trim()) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      const otpString = otp.join('');
      const res = await authService.resetPassword({
        email: email.trim().toLowerCase(),
        otp: otpString,
        new_password: newPassword,
      });
      setSuccessMessage(res.data?.message || 'Password reset successfully!');
      // Navigate back after 2 seconds
      setTimeout(() => navigation.goBack(), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password');
      // If OTP is invalid, go back to OTP step
      if (err.response?.data?.message?.includes('OTP')) {
        setOtp(['', '', '', '']);
        animateStep(() => setCurrentStep(1));
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpCountdown > 0) return;
    setError('');
    setSuccessMessage('');
    setLoading(true);
    try {
      await authService.sendForgotPasswordOTP({ email: email.trim().toLowerCase() });
      setOtpCountdown(60);
      setOtp(['', '', '', '']);
      setSuccessMessage('New OTP sent to your email!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 4);
      for (let i = 0; i < 4; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      if (digits.length >= 4) otpRefs[3]?.current?.focus();
      return;
    }
    newOtp[index] = text.replace(/\D/g, '');
    setOtp(newOtp);
    if (text && index < 3) otpRefs[index + 1]?.current?.focus();
  };

  const handleOtpKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  // Progress bar width interpolation
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['33%', '66%', '100%'],
  });

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backBtn} onPress={() => {
              if (currentStep > 0) {
                animateStep(() => setCurrentStep(currentStep - 1));
                setError('');
                setSuccessMessage('');
              } else {
                navigation.goBack();
              }
            }}>
              <Ionicons name="arrow-back" size={22} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerTextSection}>
              <Text style={styles.headerTitle}>Reset Password</Text>
              <Text style={styles.headerSubtitle}>Step {currentStep + 1} of 3</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          {/* Step Indicators */}
          <View style={styles.stepsRow}>
            {['Email', 'Verify', 'New Password'].map((label, i) => (
              <View key={`step-${i}`} style={styles.stepItem}>
                <View style={[styles.stepCircle, currentStep >= i && styles.stepCircleActive]}>
                  {currentStep > i ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, currentStep >= i && styles.stepNumActive]}>{i + 1}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, currentStep >= i && styles.stepLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          {/* Card Content */}
          <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
            {/* Error */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success */}
            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* ===== STEP 1: EMAIL ===== */}
            {currentStep === 0 && (
              <>
                <View style={styles.stepIconHeader}>
                  <View style={styles.stepIconCircle}>
                    <Ionicons name="mail" size={32} color={Colors.primary} />
                  </View>
                  <Text style={styles.stepTitle}>Enter your email</Text>
                  <Text style={styles.stepDesc}>We'll send a 4-digit OTP to your registered email address</Text>
                </View>

                <Input
                  label="Email Address"
                  icon="mail-outline"
                  placeholder="yourname@iiest.ac.in"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Button title="Send OTP" onPress={handleSendOTP} loading={loading} size="lg" icon="paper-plane-outline" style={{ marginTop: Spacing.lg }} />
              </>
            )}

            {/* ===== STEP 2: VERIFY OTP ===== */}
            {currentStep === 1 && (
              <>
                <View style={styles.stepIconHeader}>
                  <View style={[styles.stepIconCircle, { backgroundColor: Colors.success + '15' }]}>
                    <Ionicons name="keypad" size={32} color={Colors.success} />
                  </View>
                  <Text style={styles.stepTitle}>Verify OTP</Text>
                  <Text style={styles.stepDesc}>Enter the 4-digit code sent to {email}</Text>
                </View>

                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={`otp-${index}`}
                      ref={otpRefs[index]}
                      style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                      value={digit}
                      onChangeText={(text) => handleOtpChange(text, index)}
                      onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, index)}
                      keyboardType="number-pad"
                      maxLength={4}
                      textAlign="center"
                      placeholderTextColor={Colors.textMuted}
                      placeholder="•"
                    />
                  ))}
                </View>

                <Button title="Verify OTP" onPress={handleVerifyOTP} loading={loading} size="lg" icon="checkmark-circle-outline" style={{ marginTop: Spacing.md }} />

                {/* Resend */}
                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Didn't get the code? </Text>
                  {otpCountdown > 0 ? (
                    <Text style={styles.resendCountdown}>Resend in {otpCountdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOTP}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}

            {/* ===== STEP 3: NEW PASSWORD ===== */}
            {currentStep === 2 && (
              <>
                <View style={styles.stepIconHeader}>
                  <View style={[styles.stepIconCircle, { backgroundColor: '#a78bfa15' }]}>
                    <Ionicons name="lock-open" size={32} color="#a78bfa" />
                  </View>
                  <Text style={styles.stepTitle}>Set New Password</Text>
                  <Text style={styles.stepDesc}>Choose a strong password (at least 6 characters)</Text>
                </View>

                <View style={styles.passwordContainer}>
                  <Input
                    label="New Password"
                    icon="lock-closed-outline"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry={!showNewPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <View style={styles.passwordContainer}>
                  <Input
                    label="Confirm Password"
                    icon="lock-closed-outline"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Password strength indicator */}
                {newPassword.length > 0 && (
                  <View style={styles.strengthRow}>
                    <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 6 ? Colors.success : Colors.danger }]} />
                    <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 8 ? Colors.success : Colors.border }]} />
                    <View style={[styles.strengthBar, { backgroundColor: newPassword.length >= 10 && /[!@#$%^&*]/.test(newPassword) ? Colors.success : Colors.border }]} />
                    <Text style={[styles.strengthText, { color: newPassword.length >= 8 ? Colors.success : newPassword.length >= 6 ? Colors.warning : Colors.danger }]}>
                      {newPassword.length < 6 ? 'Too short' : newPassword.length < 8 ? 'Good' : 'Strong'}
                    </Text>
                  </View>
                )}

                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <View style={styles.matchRow}>
                    <Ionicons
                      name={newPassword === confirmPassword ? 'checkmark-circle' : 'close-circle'}
                      size={16}
                      color={newPassword === confirmPassword ? Colors.success : Colors.danger}
                    />
                    <Text style={[styles.matchText, { color: newPassword === confirmPassword ? Colors.success : Colors.danger }]}>
                      {newPassword === confirmPassword ? 'Passwords match' : 'Passwords don\'t match'}
                    </Text>
                  </View>
                )}

                <Button title="Reset Password" onPress={handleResetPassword} loading={loading} size="lg" icon="key-outline" style={{ marginTop: Spacing.lg }} />
              </>
            )}
          </Animated.View>

          {/* Back to login */}
          <TouchableOpacity style={styles.backToLogin} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={16} color={Colors.textSecondary} />
            <Text style={styles.backToLoginText}>Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, padding: Spacing.lg, paddingTop: 60 },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  headerTextSection: { marginLeft: Spacing.md },
  headerTitle: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '900' },
  headerSubtitle: { color: Colors.textMuted, fontSize: FontSizes.sm, marginTop: 2 },

  // Progress bar
  progressBar: { height: 4, backgroundColor: Colors.surface, borderRadius: 2, marginBottom: Spacing.lg, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },

  // Steps row
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xl },
  stepItem: { alignItems: 'center', flex: 1 },
  stepCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.border,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  stepCircleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepNum: { fontSize: 12, fontWeight: '800', color: Colors.textMuted },
  stepNumActive: { color: '#fff' },
  stepLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '700' },
  stepLabelActive: { color: Colors.primary },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },

  stepIconHeader: { alignItems: 'center', marginBottom: Spacing.xl },
  stepIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center',
    marginBottom: Spacing.md,
  },
  stepTitle: { color: Colors.text, fontSize: FontSizes.lg, fontWeight: '800' },
  stepDesc: { color: Colors.textSecondary, fontSize: FontSizes.sm, textAlign: 'center', marginTop: Spacing.xs, lineHeight: 20 },

  errorBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.danger + '15', borderRadius: BorderRadius.base,
    padding: Spacing.md, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: Colors.danger + '30',
  },
  errorText: { color: Colors.danger, fontSize: FontSizes.sm, marginLeft: Spacing.sm, flex: 1 },

  successBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.success + '15', borderRadius: BorderRadius.base,
    padding: Spacing.md, marginBottom: Spacing.base,
    borderWidth: 1, borderColor: Colors.success + '30',
  },
  successText: { color: Colors.success, fontSize: FontSizes.sm, marginLeft: Spacing.sm, flex: 1 },

  // OTP
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 14, marginVertical: Spacing.lg },
  otpInput: {
    width: 58, height: 64, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.border,
    fontSize: 28, fontWeight: '900', color: Colors.text,
  },
  otpInputFilled: { borderColor: Colors.primary, backgroundColor: Colors.primary + '08' },

  // Resend
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.lg },
  resendText: { color: Colors.textMuted, fontSize: FontSizes.sm },
  resendCountdown: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  resendLink: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700' },

  // Password
  passwordContainer: { position: 'relative' },
  eyeButton: { position: 'absolute', right: 16, top: 38, padding: 4 },

  // Strength
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthText: { fontSize: 11, fontWeight: '700', marginLeft: 4 },

  // Match
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: Spacing.sm },
  matchText: { fontSize: FontSizes.sm, fontWeight: '600' },

  // Back to login
  backToLogin: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: Spacing.xl },
  backToLoginText: { color: Colors.textSecondary, fontSize: FontSizes.base, fontWeight: '600' },
});
