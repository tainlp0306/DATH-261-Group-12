import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [role, setRole] = useState(() => localStorage.getItem('role') || null);
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state by verifying / refreshing profile if token exists
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const profile = await authApi.getProfile();
          setUser(profile);
          setRole(profile.role);
          localStorage.setItem('user', JSON.stringify(profile));
          localStorage.setItem('role', profile.role);
        } catch (error) {
          console.error('Failed to restore session:', error);
          // If token invalid, storage will be cleaned by interceptor or here
          setUser(null);
          setRole(null);
          setAccessToken(null);
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authApi.login({ username, password });
      const { access, refresh } = data;

      localStorage.setItem('access_token', access);
      localStorage.setItem('refresh_token', refresh);
      setAccessToken(access);

      // Fetch user profile immediately
      const profile = await authApi.getProfile();
      setUser(profile);
      setRole(profile.role);
      localStorage.setItem('user', JSON.stringify(profile));
      localStorage.setItem('role', profile.role);

      return { success: true, user: profile };
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!';
      return { success: false, error: errorMsg };
    }
  };

  const register = async (username, email, password, userRole = 'learner') => {
    try {
      await authApi.register({
        username,
        email,
        password,
        role: userRole,
      });

      // Auto login after registration
      const loginResult = await login(username, password);
      return loginResult;
    } catch (error) {
      let errorMsg = 'Đăng ký thất bại.';
      if (error.response?.data) {
        const errors = error.response.data;
        if (typeof errors === 'object') {
          errorMsg = Object.entries(errors)
            .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
            .join(' | ');
        } else {
          errorMsg = error.response.data.error || errorMsg;
        }
      }
      return { success: false, error: errorMsg };
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refresh_token');
    await authApi.logout(refreshToken);

    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('role');

    setUser(null);
    setRole(null);
    setAccessToken(null);
  };

  const value = {
    user,
    role,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isInstructor: role === 'instructor' || role === 'admin',
    isAdmin: role === 'admin',
    isLearner: role === 'learner',
    loading,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
