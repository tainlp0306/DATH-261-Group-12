import api from './axios';

export const adminApi = {
  // GET /admin/dashboard-stats/
  getDashboardStats: async () => {
    const response = await api.get('admin/dashboard-stats/');
    return response.data;
  },

  // GET /admin/users/?role=learner|instructor
  getUsers: async (role = '') => {
    const params = role ? { role } : {};
    const response = await api.get('admin/users/', { params });
    return response.data;
  },

  // POST /admin/users/:user_id/toggle-status/
  toggleUserStatus: async (userId) => {
    const response = await api.post(`admin/users/${userId}/toggle-status/`);
    return response.data;
  },

  // DELETE /admin/users/:user_id/
  deleteUser: async (userId) => {
    const response = await api.delete(`admin/users/${userId}/`);
    return response.data;
  },

  // GET /admin/courses/
  getAllCourses: async () => {
    const response = await api.get('admin/courses/');
    return response.data;
  },
};
