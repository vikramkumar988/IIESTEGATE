import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/api';
import { Button, Input } from '../../components';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

export default function LoginScreen({ navigation }) {
  const { login, loginWithOTP } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // OTP Login state
  const [loginMode, setLoginMode] = useState('password'); // 'password' | 'otp'
  const [otpStep, setOtpStep] = useState('email'); // 'email' | 'verify'
  const [otp, setOtp] = useState(['', '', '', '']);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');

  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Countdown timer for OTP resend
  useEffect(() => {
    if (otpCountdown > 0) {
      const timer = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [otpCountdown]);

  const animateSwitch = (callback) => {
    Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => {
      callback();
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    });
  };

  // Password login
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter both email and password');
      return;
    }
    setError('');
    setLoading(true);
    const result = await login(email.trim().toLowerCase(), password);
    if (!result.success) {
      setError(result.message);
    }
    setLoading(false);
  };

  // Send OTP for login
  const handleSendOTP = async () => {
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    setError('');
    setSuccessMessage('');
    setOtpSending(true);
    try {
      const res = await authService.sendLoginOTP({ email: email.trim().toLowerCase() });
      setOtpEmail(email.trim().toLowerCase());
      setOtpStep('verify');
      setOtpCountdown(60);
      setSuccessMessage(res.data?.message || 'OTP sent to your email!');
      setOtp(['', '', '', '']);
      setTimeout(() => otpRefs[0]?.current?.focus(), 300);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpSending(false);
    }
  };

  // Verify OTP for login
  const handleVerifyOTP = async () => {
    const otpString = otp.join('');
    if (otpString.length !== 4) {
      setError('Please enter the complete 4-digit OTP');
      return;
    }
    setError('');
    setSuccessMessage('');
    setLoading(true);
    const result = await loginWithOTP(otpEmail, otpString);
    if (!result.success) {
      setError(result.message);
      setOtp(['', '', '', '']);
      setTimeout(() => otpRefs[0]?.current?.focus(), 100);
    }
    setLoading(false);
  };

  // Resend OTP
  const handleResendOTP = async () => {
    if (otpCountdown > 0) return;
    setError('');
    setSuccessMessage('');
    setOtpSending(true);
    try {
      await authService.sendLoginOTP({ email: otpEmail });
      setOtpCountdown(60);
      setOtp(['', '', '', '']);
      setSuccessMessage('New OTP sent to your email!');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP');
    } finally {
      setOtpSending(false);
    }
  };

  // OTP input handlers
  const handleOtpChange = (text, index) => {
    const newOtp = [...otp];
    // Handle paste (multi-digit input)
    if (text.length > 1) {
      const digits = text.replace(/\D/g, '').slice(0, 4);
      for (let i = 0; i < 4; i++) {
        newOtp[i] = digits[i] || '';
      }
      setOtp(newOtp);
      if (digits.length >= 4) {
        otpRefs[3]?.current?.focus();
      }
      return;
    }

    newOtp[index] = text.replace(/\D/g, '');
    setOtp(newOtp);
    if (text && index < 3) {
      otpRefs[index + 1]?.current?.focus();
    }
  };

  const handleOtpKeyPress = (key, index) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs[index - 1]?.current?.focus();
      const newOtp = [...otp];
      newOtp[index - 1] = '';
      setOtp(newOtp);
    }
  };

  const switchMode = (mode) => {
    animateSwitch(() => {
      setLoginMode(mode);
      setOtpStep('email');
      setError('');
      setSuccessMessage('');
      setOtp(['', '', '', '']);
      setOtpCountdown(0);
    });
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Ionicons name="shield-checkmark" size={48} color={Colors.primary} />
            </View>
            <Text style={styles.appName}>IIEST E-Gate</Text>
            <Text style={styles.appSubtitle}>Campus Security Pass System</Text>
          </View>

          {/* Login Card */}
          <Animated.View style={[styles.loginCard, { opacity: fadeAnim }]}>
            <Text style={styles.cardTitle}>
              {loginMode === 'password' ? 'Welcome Back' : otpStep === 'email' ? 'Login with OTP' : 'Verify OTP'}
            </Text>
            <Text style={styles.cardSubtitle}>
              {loginMode === 'password'
                ? 'Sign in to your account'
                : otpStep === 'email'
                  ? 'We\'ll send a code to your email'
                  : `Enter the 4-digit code sent to ${otpEmail}`}
            </Text>

            {/* Error Message */}
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning" size={18} color={Colors.danger} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {successMessage ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* ===== PASSWORD MODE ===== */}
            {loginMode === 'password' && (
              <>
                <Input
                  label="Email Address"
                  icon="mail-outline"
                  placeholder="yourname@iiest.ac.in"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <View style={styles.passwordContainer}>
                  <Input
                    label="Password"
                    icon="lock-closed-outline"
                    placeholder="Enter your password"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity style={styles.eyeButton} onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                {/* Forgot Password Link */}
                <TouchableOpacity style={styles.forgotLink} onPress={() => navigation.navigate('ForgotPassword')}>
                  <Ionicons name="key-outline" size={14} color={Colors.primary} />
                  <Text style={styles.forgotLinkText}>Forgot Password?</Text>
                </TouchableOpacity>

                <Button title="Sign In" onPress={handleLogin} loading={loading} size="lg" icon="log-in-outline" style={{ marginTop: Spacing.sm }} />
              </>
            )}

            {/* ===== OTP MODE — ENTER EMAIL ===== */}
            {loginMode === 'otp' && otpStep === 'email' && (
              <>
                <Input
                  label="Email Address"
                  icon="mail-outline"
                  placeholder="yourname@iiest.ac.in"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Button title="Send OTP" onPress={handleSendOTP} loading={otpSending} size="lg" icon="paper-plane-outline" style={{ marginTop: Spacing.md }} />
              </>
            )}

            {/* ===== OTP MODE — VERIFY OTP ===== */}
            {loginMode === 'otp' && otpStep === 'verify' && (
              <>
                {/* OTP Input Boxes */}
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

                <Button title="Verify & Login" onPress={handleVerifyOTP} loading={loading} size="lg" icon="checkmark-circle-outline" style={{ marginTop: Spacing.md }} />

                {/* Resend OTP */}
                <View style={styles.resendRow}>
                  <Text style={styles.resendText}>Didn't receive the code? </Text>
                  {otpCountdown > 0 ? (
                    <Text style={styles.resendCountdown}>Resend in {otpCountdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOTP} disabled={otpSending}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Back to email */}
                <TouchableOpacity style={styles.backToEmailBtn} onPress={() => { setOtpStep('email'); setError(''); setSuccessMessage(''); }}>
                  <Ionicons name="arrow-back" size={14} color={Colors.textSecondary} />
                  <Text style={styles.backToEmailText}>Change email</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Mode Toggle */}
            <View style={styles.modeToggle}>
              <View style={styles.modeToggleLine} />
              <Text style={styles.modeToggleText}>OR</Text>
              <View style={styles.modeToggleLine} />
            </View>

            <TouchableOpacity
              style={styles.modeBtn}
              onPress={() => switchMode(loginMode === 'password' ? 'otp' : 'password')}
            >
              <Ionicons
                name={loginMode === 'password' ? 'mail-outline' : 'lock-closed-outline'}
                size={18}
                color={Colors.primary}
              />
              <Text style={styles.modeBtnText}>
                {loginMode === 'password' ? 'Login with Email OTP' : 'Login with Password'}
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Quick Login Hints (dev mode) */}
          <View style={styles.hintsContainer}>
            <Text style={styles.hintTitle}>Quick Login (Development)</Text>
            {[
              { role: 'Admin', email: 'admin@iiest.ac.in', pass: 'admin123' },
              { role: 'Guard', email: 'guard1@iiest.ac.in', pass: 'guard123' },
              { role: 'Staff', email: 'amit.sharma@iiest.ac.in', pass: 'staff123' },
            ].map((hint) => (
              <TouchableOpacity
                key={hint.email}
                style={styles.hintRow}
                onPress={() => { setEmail(hint.email); setPassword(hint.pass); setLoginMode('password'); }}
              >
                <Text style={styles.hintRole}>{hint.role}</Text>
                <Text style={styles.hintEmail}>{hint.email}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Register Link */}
          <TouchableOpacity style={styles.registerLink} onPress={() => navigation.navigate('Register')}>
            <Text style={styles.registerLinkText}>Don't have an account? <Text style={{ color: Colors.primary, fontWeight: '700' }}>Register</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, padding: Spacing.lg, justifyContent: 'center' },
  
  logoSection: { alignItems: 'center', marginBottom: Spacing.xxl },
  logoCircle: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.primary + '15', justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: Colors.primary + '30',
    marginBottom: Spacing.base,
  },
  appName: { color: Colors.text, fontSize: FontSizes.display, fontWeight: '900', letterSpacing: 1 },
  appSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.xs },

  loginCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.xl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.border,
  },
  cardTitle: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '800', marginBottom: Spacing.xs },
  cardSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.md, marginBottom: Spacing.xl },

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

  passwordContainer: { position: 'relative' },
  eyeButton: { position: 'absolute', right: 16, top: 38, padding: 4 },

  // Forgot password
  forgotLink: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-end', marginTop: Spacing.xs, marginBottom: Spacing.xs,
    paddingVertical: 4, paddingHorizontal: 8,
  },
  forgotLinkText: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '600' },

  // OTP input
  otpContainer: {
    flexDirection: 'row', justifyContent: 'center', gap: 14,
    marginVertical: Spacing.lg,
  },
  otpInput: {
    width: 58, height: 64, borderRadius: BorderRadius.lg,
    backgroundColor: Colors.background, borderWidth: 2, borderColor: Colors.border,
    fontSize: 28, fontWeight: '900', color: Colors.text,
    textAlign: 'center',
  },
  otpInputFilled: {
    borderColor: Colors.primary, backgroundColor: Colors.primary + '08',
  },

  // Resend row
  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: Spacing.md },
  resendText: { color: Colors.textMuted, fontSize: FontSizes.sm },
  resendCountdown: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '700' },
  resendLink: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700' },

  // Back to email
  backToEmailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginTop: Spacing.md },
  backToEmailText: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600' },

  // Mode toggle
  modeToggle: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.lg },
  modeToggleLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  modeToggleText: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '700', paddingHorizontal: Spacing.md },

  modeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 1.5, borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  modeBtnText: { color: Colors.primary, fontSize: FontSizes.base, fontWeight: '700' },

  hintsContainer: {
    marginTop: Spacing.xl, padding: Spacing.base,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border,
  },
  hintTitle: { color: Colors.textMuted, fontSize: FontSizes.xs, fontWeight: '700', marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  hintRole: { color: Colors.primary, fontSize: FontSizes.sm, fontWeight: '700', width: 60 },
  hintEmail: { color: Colors.textSecondary, fontSize: FontSizes.sm, flex: 1 },
  registerLink: { alignItems: 'center', marginTop: Spacing.xl },
  registerLinkText: { color: Colors.textSecondary, fontSize: FontSizes.base },
});
