import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSizes, BorderRadius, Shadows } from '../theme';

// ======================== BUTTON ========================
export const Button = ({ title, onPress, variant = 'primary', size = 'md', icon, loading, disabled, style }) => {
  const bgColor = variant === 'primary' ? Colors.primary
    : variant === 'success' ? Colors.success
    : variant === 'danger' ? Colors.danger
    : variant === 'outline' ? 'transparent'
    : variant === 'ghost' ? 'transparent'
    : Colors.surface;

  const textColor = variant === 'outline' ? Colors.primary
    : variant === 'ghost' ? Colors.textSecondary
    : variant === 'success' ? Colors.textDark
    : Colors.text;

  const height = size === 'sm' ? 38 : size === 'lg' ? 56 : 48;
  const fontSize = size === 'sm' ? FontSizes.sm : size === 'lg' ? FontSizes.lg : FontSizes.base;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      style={[
        styles.button,
        { backgroundColor: bgColor, height, opacity: disabled ? 0.5 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: Colors.primary },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <View style={styles.buttonContent}>
          {icon && <Ionicons name={icon} size={fontSize + 2} color={textColor} style={{ marginRight: Spacing.sm }} />}
          <Text style={[styles.buttonText, { color: textColor, fontSize }]}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

// ======================== INPUT ========================
export const Input = ({ label, icon, error, containerStyle, ...props }) => (
  <View style={[styles.inputContainer, containerStyle]}>
    {label && <Text style={styles.inputLabel}>{label}</Text>}
    <View style={[styles.inputWrapper, error && { borderColor: Colors.danger }]}>
      {icon && <Ionicons name={icon} size={20} color={Colors.textMuted} style={{ marginRight: Spacing.sm }} />}
      <TextInput
        style={styles.input}
        placeholderTextColor={Colors.textMuted}
        {...props}
      />
    </View>
    {error && <Text style={styles.inputError}>{error}</Text>}
  </View>
);

// ======================== CARD ========================
export const Card = ({ children, style, onPress }) => {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
      style={[styles.card, style]}
    >
      {children}
    </Wrapper>
  );
};

// ======================== BADGE ========================
export const Badge = ({ text, variant = 'primary', size = 'md' }) => {
  const bgColors = {
    primary: Colors.primary + '20',
    success: Colors.success + '20',
    danger: Colors.danger + '20',
    warning: Colors.warning + '20',
    info: Colors.info + '20',
    pending: Colors.warning + '20',
    approved: Colors.success + '20',
    rejected: Colors.danger + '20',
    expired: Colors.textMuted + '20',
    active: Colors.success + '20',
    cancelled: Colors.textMuted + '20',
  };

  const textColors = {
    primary: Colors.primary,
    success: Colors.success,
    danger: Colors.danger,
    warning: Colors.warning,
    info: Colors.info,
    pending: Colors.warning,
    approved: Colors.success,
    rejected: Colors.danger,
    expired: Colors.textMuted,
    active: Colors.success,
    cancelled: Colors.textMuted,
  };

  const padding = size === 'sm' ? { paddingHorizontal: 8, paddingVertical: 3 } : { paddingHorizontal: 12, paddingVertical: 5 };
  const fontSize = size === 'sm' ? FontSizes.xs : FontSizes.sm;

  return (
    <View style={[styles.badge, { backgroundColor: bgColors[variant] || bgColors.primary }, padding]}>
      <Text style={[styles.badgeText, { color: textColors[variant] || textColors.primary, fontSize }]}>
        {text}
      </Text>
    </View>
  );
};

// ======================== HEADER ========================
export const Header = ({ title, subtitle, leftIcon, rightIcon, onLeftPress, onRightPress, rightBadge, showBack, onBack }) => {
  const resolvedLeftIcon = leftIcon || (showBack ? 'arrow-back' : undefined);
  const resolvedOnLeftPress = onLeftPress || onBack;
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {resolvedLeftIcon && (
          <TouchableOpacity onPress={resolvedOnLeftPress} style={styles.headerIconBtn}>
            <Ionicons name={resolvedLeftIcon} size={24} color={Colors.text} />
          </TouchableOpacity>
        )}
        <View>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      {rightIcon && (
        <TouchableOpacity onPress={onRightPress} style={styles.headerIconBtn}>
          <Ionicons name={rightIcon} size={24} color={Colors.text} />
          {rightBadge > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{rightBadge > 99 ? '99+' : rightBadge}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

// ======================== STAT CARD ========================
export const StatCard = ({ icon, label, value, color = Colors.primary }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Ionicons name={icon} size={24} color={color} />
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// ======================== EMPTY STATE ========================
export const EmptyState = ({ icon = 'folder-open-outline', title, message }) => (
  <View style={styles.emptyState}>
    <Ionicons name={icon} size={64} color={Colors.textMuted} />
    <Text style={styles.emptyTitle}>{title}</Text>
    {message && <Text style={styles.emptyMessage}>{message}</Text>}
  </View>
);

// ======================== LOADING ========================
export const LoadingScreen = ({ message = 'Loading...' }) => (
  <View style={styles.loadingScreen}>
    <ActivityIndicator size="large" color={Colors.primary} />
    <Text style={styles.loadingText}>{message}</Text>
  </View>
);

// ======================== AVATAR ========================
export const Avatar = ({ uri, name, size = 48 }) => {
  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  const initials = name ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '?';
  return (
    <View style={[styles.avatarPlaceholder, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  );
};

// ======================== STYLES ========================
const styles = StyleSheet.create({
  // Button
  button: {
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    ...Shadows.sm,
  },
  buttonContent: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { fontWeight: '700', letterSpacing: 0.5 },

  // Input
  inputContainer: { marginBottom: Spacing.base },
  inputLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '600', marginBottom: Spacing.xs },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.base, height: 52,
    borderWidth: 1, borderColor: Colors.border,
  },
  input: { flex: 1, color: Colors.text, fontSize: FontSizes.base },
  inputError: { color: Colors.danger, fontSize: FontSizes.xs, marginTop: Spacing.xs },

  // Card
  card: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.base, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, ...Shadows.sm,
  },

  // Badge
  badge: { borderRadius: BorderRadius.full, alignSelf: 'flex-start' },
  badgeText: { fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.base,
    paddingTop: Spacing.huge, backgroundColor: Colors.background,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '800' },
  headerSubtitle: { color: Colors.textSecondary, fontSize: FontSizes.sm, marginTop: 2 },
  headerIconBtn: { padding: Spacing.sm, position: 'relative' },
  headerBadge: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: Colors.danger, borderRadius: 10,
    minWidth: 18, height: 18, justifyContent: 'center', alignItems: 'center',
  },
  headerBadgeText: { color: Colors.text, fontSize: 10, fontWeight: '800' },

  // Stat Card
  statCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
    padding: Spacing.md, borderLeftWidth: 3, flex: 1, marginHorizontal: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { color: Colors.text, fontSize: FontSizes.xxl, fontWeight: '800', marginTop: Spacing.xs },
  statLabel: { color: Colors.textSecondary, fontSize: FontSizes.xs, fontWeight: '600', marginTop: 2 },

  // Empty State
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: Spacing.xxxl },
  emptyTitle: { color: Colors.textSecondary, fontSize: FontSizes.lg, fontWeight: '700', marginTop: Spacing.base },
  emptyMessage: { color: Colors.textMuted, fontSize: FontSizes.md, textAlign: 'center', marginTop: Spacing.sm },

  // Loading
  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.textSecondary, fontSize: FontSizes.md, marginTop: Spacing.base },

  // Avatar
  avatar: { backgroundColor: Colors.surface },
  avatarPlaceholder: { backgroundColor: Colors.primary + '30', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: Colors.primary, fontWeight: '800' },
});
