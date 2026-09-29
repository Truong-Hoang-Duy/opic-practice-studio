import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('opic_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      if (token) {
        try {
          const res = await authApi.getMe();
          setUser(res.data);
        } catch (err) {
          console.error("Auth check failed:", err);
          logout();
        }
      }
      setLoading(false);
    };
    fetchUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await authApi.login({ email, password });
    const { access_token, user_id, full_name } = res.data;
    localStorage.setItem('opic_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, full_name });
    return res.data;
  };

  const register = async (email, password, full_name) => {
    const res = await authApi.register({ email, password, full_name });
    const { access_token, user_id } = res.data;
    localStorage.setItem('opic_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, full_name });
    return res.data;
  };

  const defaultLogin = async () => {
    const res = await authApi.defaultLogin();
    const { access_token, user_id, email, full_name } = res.data;
    localStorage.setItem('opic_token', access_token);
    setToken(access_token);
    setUser({ id: user_id, email, full_name });
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('opic_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, defaultLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
