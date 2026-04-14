import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { LoadingScreen } from '../components';
import { Colors } from '../theme';

// Auth
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import ForgotPasswordScreen from '../screens/auth/ForgotPasswordScreen';

// Guard
import GuardDashboard from '../screens/guard/GuardDashboard';
import CreateVisitRequest from '../screens/guard/CreateVisitRequest';
import CreateGeneralVisit from '../screens/guard/CreateGeneralVisit';
import IncidentReportScreen from '../screens/guard/IncidentReportScreen';
import ScanQR from '../screens/guard/ScanQR';
import GenerateQR from '../screens/guard/GenerateQR';
import EditVisitRequest from '../screens/guard/EditVisitRequest';

// Staff
import StaffDashboard from '../screens/staff/StaffDashboard';
import RequestDetail from '../screens/staff/RequestDetail';

// Admin
import AdminDashboard from '../screens/admin/AdminDashboard';
import UserManagement from '../screens/admin/UserManagement';
import AllVisits from '../screens/admin/AllVisits';
import PendingUsers from '../screens/admin/PendingUsers';
import ActivityLogScreen from '../screens/admin/ActivityLogScreen';
import VisitDetail from '../screens/admin/VisitDetail';
import UserDetailScreen from '../screens/admin/UserDetailScreen';
import BlacklistScreen from '../screens/admin/BlacklistScreen';
import IncidentListScreen from '../screens/admin/IncidentListScreen';

// Common (shared)
import VisitHistory from '../screens/common/VisitHistory';
import NotificationsScreen from '../screens/common/NotificationsScreen';
import ProfileScreen from '../screens/common/ProfileScreen';
import EmergencyContactsScreen from '../screens/common/EmergencyContactsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.background },
};

const tabScreenOptions = ({ route }) => ({
  headerShown: false,
  tabBarStyle: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: 62,
    paddingBottom: 6,
    paddingTop: 6,
  },
  tabBarActiveTintColor: Colors.primary,
  tabBarInactiveTintColor: Colors.textMuted,
  tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  tabBarIcon: ({ focused, color }) => {
    const icons = {
      Dashboard: focused ? 'home' : 'home-outline',
      Scan: focused ? 'qr-code' : 'qr-code-outline',
      History: focused ? 'time' : 'time-outline',
      Profile: focused ? 'person' : 'person-outline',
      Users: focused ? 'people' : 'people-outline',
    };
    return <Ionicons name={icons[route.name] || 'ellipse'} size={21} color={color} />;
  },
});

// =================== GUARD TABS ===================
function GuardTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={GuardDashboard} />
      <Tab.Screen name="Scan" component={ScanQR} />
      <Tab.Screen name="History" component={VisitHistory} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// =================== STAFF TABS ===================
function StaffTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={StaffDashboard} />
      <Tab.Screen name="History" component={VisitHistory} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// =================== ADMIN TABS ===================
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboard} />
      <Tab.Screen name="Users" component={UserManagement} />
      <Tab.Screen name="History" component={VisitHistory} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// =================== MAIN NAVIGATOR ===================
export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen message="Loading..." />;

  const getMainScreen = () => {
    if (!user) return null;
    switch (user.role) {
      case 'guard': return GuardTabs;
      case 'staff': return StaffTabs;
      case 'admin': return AdminTabs;
      default: return GuardTabs;
    }
  };

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={screenOptions}>
        {!user ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          </>
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={getMainScreen()} />
            <Stack.Screen name="CreateVisitRequest" component={CreateVisitRequest} />
            <Stack.Screen name="CreateGeneralVisit" component={CreateGeneralVisit} />
            <Stack.Screen name="ScanQR" component={ScanQR} />
            <Stack.Screen name="GenerateQR" component={GenerateQR} />
            <Stack.Screen name="EditVisitRequest" component={EditVisitRequest} />
            <Stack.Screen name="RequestDetail" component={RequestDetail} />
            <Stack.Screen name="VisitHistory" component={VisitHistory} />
            <Stack.Screen name="UserManagement" component={UserManagement} />
            <Stack.Screen name="AllVisits" component={AllVisits} />
            <Stack.Screen name="PendingUsers" component={PendingUsers} />
            <Stack.Screen name="ActivityLog" component={ActivityLogScreen} />
            <Stack.Screen name="VisitDetail" component={VisitDetail} />
            <Stack.Screen name="UserDetail" component={UserDetailScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="IncidentReport" component={IncidentReportScreen} />
            <Stack.Screen name="BlacklistManagement" component={BlacklistScreen} />
            <Stack.Screen name="IncidentList" component={IncidentListScreen} />
            <Stack.Screen name="EmergencyContacts" component={EmergencyContactsScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
