import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/authApi';

const AuthContext = createContext(null);

export const normalizeRole = (value) => {
  if (typeof value !== 'string') return value || null;
  return value.trim().toLowerCase();
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [role, setRole] = useState(() => {
    const savedUser = (() => {
      try {
        const raw = localStorage.getItem('user');
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();

    return normalizeRole(savedUser?.role ?? localStorage.getItem('role'));
  });
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem('access_token') || null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state by verifying / refreshing profile if token exists
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const profile = await authApi.getProfile();
          const normalizedRole = normalizeRole(profile.role);
          setUser(profile);
          setRole(normalizedRole);
          localStorage.setItem('user', JSON.stringify(profile));
          localStorage.setItem('role', normalizedRole);
        } catch (error) {
          console.error('Failed to restore session:', error);
          setUser(null);
          setRole(null);
          setAccessToken(null);
          localStorage.removeItem('user');
          localStorage.removeItem('role');
          localStorage.removeItem('access_token');
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
      const normalizedRole = normalizeRole(profile.role);
      setUser(profile);
      setRole(normalizedRole);
      localStorage.setItem('user', JSON.stringify(profile));
      localStorage.setItem('role', normalizedRole);

      return { success: true, user: profile };
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail ||
        error.response?.data?.error ||
        'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin!';
      return { success: false, error: errorMsg };
    }
  };

  const loginWithGoogle = async (idToken) => {
    try {
      const tokens = await authApi.googleLogin(idToken);
      localStorage.setItem('access_token', tokens.access);
      localStorage.setItem('refresh_token', tokens.refresh);
      setAccessToken(tokens.access);
      const profile = await authApi.getProfile();
      const normalizedRole = normalizeRole(profile.role);
      setUser(profile);
      setRole(normalizedRole);
      localStorage.setItem('user', JSON.stringify(profile));
      localStorage.setItem('role', normalizedRole);
      return { success: true, user: profile };
    } catch (error) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('role');
      setAccessToken(null);
      return {
        success: false,
        error: error.response?.data?.error || 'Đăng nhập Google thất bại.',
      };
    }
  };

  const register = async (username, email, password, userRole = 'learner', otp = '') => {
    try {
      if (!otp) {
        const result = await authApi.requestRegistrationOtp(email);
        return { success: true, requiresOtp: true, message: result.message };
      }

      await authApi.confirmRegistrationOtp({
        username,
        email,
        password,
        role: userRole,
        otp,
      });

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

  const currentRole = normalizeRole(role || user?.role);

  const value = {
    user,
    role: currentRole,
    accessToken,
    isAuthenticated: Boolean(accessToken) && Boolean(user || currentRole),
    isInstructor: currentRole === 'instructor' || currentRole === 'admin',
    isAdmin: currentRole === 'admin',
    isLearner: currentRole === 'learner',
    loading,
    login,
    loginWithGoogle,
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
