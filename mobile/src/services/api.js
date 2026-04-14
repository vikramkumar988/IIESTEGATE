import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// ✅ Production server on Render
const API_BASE_URL = 'https://iiestegate.onrender.com/api';

const getBaseUrl = () => 'https://iiestegate.onrender.com';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor — attach JWT token
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors globally
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token expired — try refresh or logout
      try {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          const newToken = response.data.data.token;
          await SecureStore.setItemAsync('token', newToken);
          // Retry original request
          error.config.headers.Authorization = `Bearer ${newToken}`;
          return api(error.config);
        }
      } catch (refreshError) {
        // Refresh failed — clear tokens
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');
      }
    }
    return Promise.reject(error);
  }
);

// ============== AUTH ==============
export const authService = {
  login: (data) => api.post('/auth/login', data),
  registerPublic: (data) => {
    if (data instanceof FormData) {
      return api.post('/auth/register-public', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.post('/auth/register-public', data);
  },
  getMe: () => api.get('/auth/me'),
  updatePushToken: (push_token) => api.put('/auth/push-token', { push_token }),
  changePassword: (data) => api.put('/auth/change-password', data),
  // OTP Login
  sendLoginOTP: (data) => api.post('/auth/send-login-otp', data),
  verifyLoginOTP: (data) => api.post('/auth/verify-login-otp', data),
  // Forgot Password
  sendForgotPasswordOTP: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// ============== VISITS ==============
export const visitService = {
  create: (formData) => api.post('/visits', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: (params) => api.get('/visits', { params }),
  getPending: () => api.get('/visits/pending'),
  getById: (id) => api.get(`/visits/${id}`),
  edit: (id, data) => api.put(`/visits/${id}/edit`, data),
  reRaise: (id) => api.put(`/visits/${id}/re-raise`),
  approve: (id, data) => api.put(`/visits/${id}/approve`, data),
  reject: (id, data) => api.put(`/visits/${id}/reject`, data),
  cancel: (id, data) => api.put(`/visits/${id}/cancel`, data || {}),
  getMissed: () => api.get('/visits/missed'),
  getHistory: (params) => api.get('/visits/history', { params }),
  getStaffHistory: (params) => api.get('/visits/history', { params }),
  getStaffPending: () => api.get('/visits/pending'),
  confirmMeeting: (id, data) => api.put(`/visits/${id}/confirm-meeting`, data),
  lookupVisitor: (phone) => api.get('/visits/lookup-visitor', { params: { phone } }),
  guardHistory: (params) => api.get('/visits/guard-history', { params }),
  searchVisitors: (q) => api.get('/visits/search-visitor', { params: { q } }),
  // New enterprise endpoints
  referVisitor: (id, data) => api.post(`/visits/${id}/refer`, data),
  getStaffActive: () => api.get('/visits/staff-active'),
  getVisitorProfile: (visitorId) => api.get(`/visits/visitor-profile/${visitorId}`),
};

// ============== GENERAL VISITS ==============
export const generalVisitService = {
  create: (formData) => api.post('/general-visits', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  getAll: (params) => api.get('/general-visits', { params }),
  getById: (id) => api.get(`/general-visits/${id}`),
  revoke: (id) => api.put(`/general-visits/${id}/revoke`),
};

// ============== GATE PASSES ==============
export const gatePassService = {
  generate: (visitId) => api.post(`/passes/generate/${visitId}`),
  generateGeneral: (generalVisitId) => api.post(`/passes/generate-general/${generalVisitId}`),
  verify: (data) => api.post('/passes/verify', data),
  logExit: (data) => api.post('/passes/exit', data),
  getAll: (params) => api.get('/passes', { params }),
  getById: (id) => api.get(`/passes/${id}`),
  revoke: (id) => api.put(`/passes/${id}/revoke`),
  sendSMS: (passId) => api.post(`/passes/${passId}/send-sms`),
};

// ============== NOTIFICATIONS ==============
export const notificationService = {
  getAll: (params) => api.get('/notifications', { params }),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  getUnreadCount: () => api.get('/notifications/unread-count'),
};

// ============== USERS ==============
export const userService = {
  searchStaff: (params) => api.get('/users/staff', { params }),
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  getPendingUsers: () => api.get('/users/pending'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  approveUser: (id) => api.put(`/users/${id}/approve`),
  rejectUser: (id) => api.put(`/users/${id}/reject-registration`),
  delete: (id) => api.delete(`/users/${id}`),
  // Blacklist
  blacklistVisitor: (data) => api.post('/users/blacklist', data),
  unblacklistVisitor: (data) => api.post('/users/unblacklist', data),
  getBlacklistedVisitors: () => api.get('/users/blacklisted-visitors'),
  // Staff Availability
  updateAvailability: (data) => api.patch('/users/availability', data),
  // Headcount
  getStillInside: () => api.get('/users/still-inside'),
  forceExit: (data) => api.post('/users/force-exit', data),
};

// ============== DASHBOARD ==============
export const dashboardService = {
  getStats: () => api.get('/dashboard/stats'),
  getVisitsChart: (params) => api.get('/dashboard/visits-chart', { params }),
  getActivePasses: () => api.get('/dashboard/active-passes'),
  getGuardActivity: () => api.get('/dashboard/guard-activity'),
  getDayWise: (params) => api.get('/dashboard/day-wise', { params }),
  getActivityLogs: (params) => api.get('/dashboard/activity-logs', { params }),
  // Lockdown
  getLockdownStatus: () => api.get('/dashboard/lockdown-status'),
  activateLockdown: (data) => api.post('/dashboard/lockdown', data),
  liftLockdown: () => api.delete('/dashboard/lockdown'),
  // New enterprise endpoints
  getDateRangeReport: (params) => api.get('/dashboard/date-range-report', { params }),
  getScanLogs: (params) => api.get('/dashboard/scan-logs', { params }),
  getStaffPerformance: (params) => api.get('/dashboard/staff-performance', { params }),
};

// ============== JOURNEYS ==============
export const journeyService = {
  getActiveJourney: (visitorId) => api.get(`/journeys/visitor/${visitorId}/active`),
  getVisitorJourneys: (visitorId, params) => api.get(`/journeys/visitor/${visitorId}/history`, { params }),
  getJourney: (journeyId) => api.get(`/journeys/${journeyId}`),
  getJourneyByVisitRequest: (visitRequestId) => api.get(`/journeys/visit-request/${visitRequestId}`),
};

// ============== PRE-REGISTRATION ==============
export const preRegService = {
  getPending: () => api.get('/pre-register/pending'),
  getAll: (params) => api.get('/pre-register/all', { params }),
  approve: (id, data) => api.put(`/pre-register/${id}/approve`, data),
  reject: (id, data) => api.put(`/pre-register/${id}/reject`, data),
};

// Helper to get the pre-registration URL for sharing
export const getPreRegUrl = () => API_BASE_URL.replace('/api', '/pre-register');

export { getBaseUrl };
export default api;

