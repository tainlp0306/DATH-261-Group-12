import api from './axios';

export const authApi = {
  // POST /register/ - Register new user
  register: async (userData) => {
    const response = await api.post('register/', userData);
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
};
