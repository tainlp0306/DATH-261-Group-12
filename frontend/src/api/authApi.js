import api from './axios';

export const authApi = {
  // POST /register/ - Register new user
  register: async (userData) => {
    const response = await api.post('register/', userData);
    return response.data;
  },

  requestRegistrationOtp: async (email) => {
    const response = await api.post('request-registration-otp/', { email });
    return response.data;
  },

  confirmRegistrationOtp: async (registrationData) => {
    const response = await api.post('confirm-registration-otp/', registrationData);
    return response.data;
  },

  requestOtp: async (email) => {
    const response = await api.post('request-otp/', { email });
    return response.data;
  },

  confirmOtp: async (resetData) => {
    const response = await api.post('confirm-otp/', resetData);
    return response.data;
  },

  // POST /login/ - Obtain JWT token pair
  login: async (credentials) => {
    const response = await api.post('login/', credentials);
    return response.data;
  },

  // POST /logout/ - Blacklist refresh token
  logout: async (refreshToken) => {
    if (!refreshToken) return;
    try {
      const response = await api.post('logout/', { refresh: refreshToken });
      return response.data;
    } catch (err) {
      console.warn('Logout API call failed:', err);
    }
  },

  // GET /profile/ - Fetch current authenticated user's profile
  getProfile: async () => {
    const response = await api.get('profile/');
    return response.data;
  },

  // POST /password/change/ - Change user password
  changePassword: async (newPassword) => {
    const response = await api.post('password/change/', { new_password: newPassword });
    return response.data;
  },

  requestPasswordReset: async (email) => {
    const response = await api.post('password-reset/', { email });
    return response.data;
  },

  confirmPasswordReset: async ({ uid, token, new_password }) => {
    const response = await api.post('password-reset-confirm/', { uid, token, new_password });
    return response.data;
  },

  googleLogin: async (idToken) => {
    const response = await api.post('google-login/', { id_token: idToken });
    return response.data;
  },

  getNotifications: async () => {
    const response = await api.get('notifications/');
    return response.data;
  },

  markNotificationsRead: async (ids) => {
    const response = await api.patch('notifications/', ids ? { ids } : {});
    return response.data;
  },

  confirmNotification: async (notificationId) => {
    const response = await api.post(`notifications/${notificationId}/confirm/`);
    return response.data;
  },

  reportComment: async (comment, reason) => {
    const response = await api.post('reports/', { comment, reason });
    return response.data;
  },
};
