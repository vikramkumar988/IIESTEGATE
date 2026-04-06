import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Header, Input, Button } from '../../components';
import { authService } from '../../services/api';
import { Colors, Spacing, FontSizes, BorderRadius } from '../../theme';

const STEPS = [
  { id: 1, title: 'Identity', icon: 'person' },
  { id: 2, title: 'Credentials', icon: 'key' },
  { id: 3, title: 'Verification', icon: 'shield-checkmark' },
];

const ORGS = [
  { id: 'iiest', label: 'IIEST Shibpur', icon: 'school' },
  { id: 'bank', label: 'United Bank / PNB', icon: 'business' },
  { id: 'school', label: 'Model School', icon: 'library' },
  { id: 'iti', label: 'ITI College', icon: 'construct' },
  { id: 'other', label: 'Other Staff', icon: 'people' },
];

const DEPARTMENTS = ['Architecture', 'CE', 'CST', 'EE', 'ETC', 'IT', 'ME', 'MET', 'MIN', 'Management', 'HOD Office', 'Bank/Post Office', 'Other'];
const GATES = ['Main Gate', 'Gate 1', 'Gate 2', 'South Gate'];

export default function RegisterScreen({ navigation }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState(null);
  
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'staff', // staff, guard
    organization: 'iiest',
    department: '',
    designation: '',
    gate_assigned: 'Main Gate',
    employee_id: '',
  });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const pickImage = async (useCamera = false) => {
    try {
      const permissionResult = useCamera 
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permissionResult.granted === false) {
        Alert.alert('Permission Rejected', 'We need access to your camera/gallery to upload a profile photo.');
        return;
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });

      if (!result.canceled) {
        setProfilePhoto(result.assets[0]);
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const validateStep = (currentStep) => {
    if (currentStep === 1) {
      if (!form.full_name || !form.phone) {
        Alert.alert('Required Fields', 'Please enter your name and phone number');
        return false;
      }
      if (!profilePhoto) {
        Alert.alert('Photo Required', 'Please upload a profile photo for verification');
        return false;
      }
    } else if (currentStep === 2) {
      if (!form.email || !form.password) {
        Alert.alert('Required Fields', 'Please enter your email and password');
        return false;
      }
      if (form.password !== form.confirmPassword) {
        Alert.alert('Error', 'Passwords do not match');
        return false;
      }
      if (form.password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) setStep(prev => prev - 1);
    else navigation.goBack();
  };

  const handleRegister = async () => {
    if (form.role === 'staff' && form.organization === 'iiest' && !form.department) {
      Alert.alert('Error', 'Please select your department');
      return;
    }
    
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('full_name', form.full_name.trim());
      formData.append('email', form.email.trim().toLowerCase());
      formData.append('phone', form.phone.trim());
      formData.append('password', form.password);
      formData.append('role', form.role);
      formData.append('organization', form.organization);
      
      if (form.role === 'staff') {
        formData.append('department', form.department.trim());
        formData.append('designation', form.designation.trim());
        if (form.employee_id.trim()) formData.append('employee_id', form.employee_id.trim());
      }
      if (form.role === 'guard') {
        formData.append('gate_assigned', form.gate_assigned);
        if (form.employee_id.trim()) formData.append('employee_id', form.employee_id.trim());
      }

      if (profilePhoto) {
        const localUri = profilePhoto.uri;
        const filename = localUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('photo', { uri: localUri, name: filename, type });
      }

      await authService.registerPublic(formData);
      Alert.alert(
        'Registration Submitted ✅',
        'Your registration has been submitted successfully. Please wait for an administrator to approve your account before you can login.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (e) {
      console.log('Registration error:', e);
      Alert.alert('Error', e.response?.data?.message || 'Registration failed. Please check your data.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <View style={styles.stepIndicatorContainer}>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }]} />
      </View>
      <View style={styles.stepsRow}>
        {STEPS.map((s) => (
          <View key={s.id} style={styles.stepWrapper}>
            <View style={[
              styles.stepCircle, 
              step >= s.id ? styles.stepActive : styles.stepInactive,
              step > s.id && styles.stepCompleted
            ]}>
              {step > s.id ? (
                <Ionicons name="checkmark" size={16} color="white" />
              ) : (
                <Ionicons name={s.icon} size={16} color={step >= s.id ? Colors.primary : Colors.textMuted} />
              )}
            </View>
            <Text style={[styles.stepTitle, step >= s.id && styles.stepTitleActive]}>{s.title}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Header title="Join E-Gate" showBack onBack={handleBack} />
      
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {renderStepIndicator()}

        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Tell us who you are</Text>
            
            <View style={styles.photoContainer}>
              <TouchableOpacity style={styles.photoWrapper} onPress={() => pickImage(false)}>
                {profilePhoto ? (
                  <Image source={{ uri: profilePhoto.uri }} style={styles.photo} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="camera" size={32} color={Colors.primary} />
                    <Text style={styles.photoText}>Upload Photo</Text>
                  </View>
                )}
                {profilePhoto && (
                  <View style={styles.photoEditIcon}>
                    <Ionicons name="pencil" size={14} color="white" />
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.photoActionRow}>
                <TouchableOpacity style={styles.photoActionBtn} onPress={() => pickImage(true)}>
                  <Ionicons name="camera-outline" size={18} color={Colors.primary} />
                  <Text style={styles.photoActionText}>Take Shot</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Input label="Full Name" value={form.full_name} onChangeText={(v) => updateForm('full_name', v)} icon="person-outline" placeholder="Enter your full name" />
            <Input label="Mobile Number" value={form.phone} onChangeText={(v) => updateForm('phone', v)} icon="call-outline" placeholder="Phone for contact" keyboardType="phone-pad" />
            <Input label="Employee / ID Number (Optional)" value={form.employee_id} onChangeText={(v) => updateForm('employee_id', v)} icon="id-card-outline" placeholder="Your institutional ID" />
            
            <Button title="Continue to Credentials" onPress={handleNext} style={styles.mainBtn} />
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Set your login details</Text>
            <Input label="Email Address" value={form.email} onChangeText={(v) => updateForm('email', v)} icon="mail-outline" placeholder="user@iiest.ac.in" keyboardType="email-address" autoCapitalize="none" />
            <Input label="Password" value={form.password} onChangeText={(v) => updateForm('password', v)} icon="lock-closed-outline" placeholder="Min 6 characters" secureTextEntry />
            <Input label="Confirm Password" value={form.confirmPassword} onChangeText={(v) => updateForm('confirmPassword', v)} icon="shield-outline" placeholder="Repeat password" secureTextEntry />
            
            <View style={styles.roleSelection}>
              <Text style={styles.label}>Registering as:</Text>
              <View style={styles.roleRow}>
                <TouchableOpacity style={[styles.roleBtn, form.role === 'staff' && styles.activeRole]} onPress={() => updateForm('role', 'staff')}>
                  <Ionicons name="school" size={20} color={form.role === 'staff' ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.roleText, form.role === 'staff' && styles.activeRoleText]}>Professor / Staff</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.roleBtn, form.role === 'guard' && styles.activeRole]} onPress={() => updateForm('role', 'guard')}>
                  <Ionicons name="shield" size={20} color={form.role === 'guard' ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.roleText, form.role === 'guard' && styles.activeRoleText]}>Security Guard</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Button title="Continue to Workplace" onPress={handleNext} style={styles.mainBtn} />
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.sectionTitle}>Final Details</Text>
            
            <Text style={styles.label}>Select Organization</Text>
            <View style={styles.orgGrid}>
              {ORGS.map((org) => (
                <TouchableOpacity 
                  key={org.id} 
                  style={[styles.orgCard, form.organization === org.id && styles.activeOrgCard]}
                  onPress={() => updateForm('organization', org.id)}
                >
                  <Ionicons name={org.icon} size={24} color={form.organization === org.id ? Colors.primary : Colors.textMuted} />
                  <Text style={[styles.orgLabel, form.organization === org.id && styles.activeOrgLabel]}>{org.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {form.role === 'staff' ? (
              <>
                {form.organization === 'iiest' && (
                  <>
                    <Text style={styles.label}>Department</Text>
                    <View style={styles.chipGrid}>
                      {DEPARTMENTS.map((dept) => (
                        <TouchableOpacity 
                          key={dept} 
                          style={[styles.chip, form.department === dept && styles.activeChip]}
                          onPress={() => updateForm('department', dept)}
                        >
                          <Text style={[styles.chipText, form.department === dept && styles.activeChipText]}>{dept}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </>
                )}
                <Input label="Designation" value={form.designation} onChangeText={(v) => updateForm('designation', v)} icon="ribbon-outline" placeholder={form.organization === 'bank' ? 'Bank Manager, Clerk, etc.' : form.organization === 'school' ? 'Teacher, Principal, etc.' : 'Professor, HOD, etc.'} />
              </>
            ) : (
              <>
                <Text style={styles.label}>Assigned Gate</Text>
                <View style={styles.chipGrid}>
                  {GATES.map((gate) => (
                    <TouchableOpacity 
                      key={gate} 
                      style={[styles.chip, form.gate_assigned === gate && styles.activeChip]}
                      onPress={() => updateForm('gate_assigned', gate)}
                    >
                      <Text style={[styles.chipText, form.gate_assigned === gate && styles.activeChipText]}>{gate}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Ionicons name="information-circle" size={18} color={Colors.primary} />
                <Text style={styles.summaryTitle}>Registration Summary</Text>
              </View>
              
              {profilePhoto && (
                <View style={{ alignItems: 'center', marginBottom: Spacing.md }}>
                  <Image source={{ uri: profilePhoto.uri }} style={{ width: 60, height: 60, borderRadius: 30, borderWidth: 2, borderColor: Colors.primary }} />
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Name</Text>
                <Text style={styles.summaryValue}>{form.full_name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Email</Text>
                <Text style={styles.summaryValue}>{form.email}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phone</Text>
                <Text style={styles.summaryValue}>{form.phone}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Role</Text>
                <Text style={styles.summaryValue}>{form.role === 'staff' ? '👨‍🏫 Professor / Staff' : '🛡️ Security Guard'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Organization</Text>
                <Text style={styles.summaryValue}>{ORGS.find(o => o.id === form.organization)?.label || form.organization}</Text>
              </View>
              {form.role === 'staff' && form.department ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Department</Text>
                  <Text style={styles.summaryValue}>{form.department}</Text>
                </View>
              ) : null}
              {form.role === 'staff' && form.designation ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Designation</Text>
                  <Text style={styles.summaryValue}>{form.designation}</Text>
                </View>
              ) : null}
              {form.role === 'guard' ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Gate</Text>
                  <Text style={styles.summaryValue}>{form.gate_assigned}</Text>
                </View>
              ) : null}
              {form.employee_id ? (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Employee ID</Text>
                  <Text style={styles.summaryValue}>{form.employee_id}</Text>
                </View>
              ) : null}

              <Text style={styles.summaryNote}>Your request will be sent to the administrator for verification. You'll be notified once approved.</Text>
            </View>

            <Button title="Submit Registration" loading={loading} onPress={handleRegister} variant="primary" style={styles.submitBtn} />
          </View>
        )}

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.base, paddingBottom: 60 },

  stepIndicatorContainer: { marginBottom: Spacing.xl, marginTop: Spacing.md },
  progressBarBg: { height: 4, backgroundColor: Colors.border, borderRadius: 2, position: 'absolute', top: 15, left: '15%', right: '15%' },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.sm },
  stepWrapper: { alignItems: 'center', width: 80 },
  stepCircle: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border },
  stepActive: { borderColor: Colors.primary, backgroundColor: Colors.primary + '10' },
  stepCompleted: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  stepInactive: { borderColor: Colors.border },
  stepTitle: { fontSize: 10, color: Colors.textMuted, marginTop: 8, fontWeight: '600' },
  stepTitleActive: { color: Colors.primary, fontWeight: '700' },

  stepContent: { animationDuration: '200ms' },
  sectionTitle: { color: Colors.text, fontSize: FontSizes.xl, fontWeight: '800', marginBottom: Spacing.lg, textAlign: 'center' },

  photoContainer: { alignItems: 'center', marginBottom: Spacing.xl },
  photoWrapper: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, position: 'relative', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoPlaceholder: { alignItems: 'center' },
  photoText: { fontSize: 10, color: Colors.primary, fontWeight: '700', marginTop: 4 },
  photoEditIcon: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 2, alignItems: 'center' },
  photoActionRow: { flexDirection: 'row', marginTop: Spacing.md },
  photoActionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  photoActionText: { color: Colors.primary, fontSize: 12, fontWeight: '600' },

  label: { color: Colors.textSecondary, fontSize: FontSizes.sm, fontWeight: '700', marginBottom: Spacing.sm, marginTop: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  roleSelection: { marginVertical: Spacing.md },
  roleRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
  roleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.surface, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  activeRole: { borderColor: Colors.primary, backgroundColor: Colors.primary + '05' },
  roleText: { color: Colors.textMuted, fontSize: FontSizes.sm, fontWeight: '600' },
  activeRoleText: { color: Colors.primary, fontWeight: '700' },

  orgGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  orgCard: { width: '31%', backgroundColor: Colors.surface, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  activeOrgCard: { borderColor: Colors.primary, backgroundColor: Colors.primary + '03' },
  orgLabel: { fontSize: 10, color: Colors.textMuted, marginTop: 8, textAlign: 'center', fontWeight: '600' },
  activeOrgLabel: { color: Colors.primary, fontWeight: '700' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: Spacing.sm },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.surface, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: Colors.border },
  activeChip: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  activeChipText: { color: 'white' },

  summaryCard: { backgroundColor: Colors.surface, borderRadius: BorderRadius.lg, padding: Spacing.lg, marginTop: Spacing.xl, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 4, borderLeftColor: Colors.primary },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  summaryTitle: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '800', textTransform: 'uppercase' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { color: Colors.textSecondary, fontSize: FontSizes.sm },
  summaryValue: { color: Colors.text, fontSize: FontSizes.sm, fontWeight: '700' },
  summaryNote: { color: Colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },

  mainBtn: { marginTop: Spacing.xl, width: '100%', paddingVertical: 14 },
  submitBtn: { marginTop: Spacing.xl, backgroundColor: Colors.primary, width: '100%', paddingVertical: 14 },
});
