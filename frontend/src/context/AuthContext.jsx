import React, { createContext, useContext, useState, useEffect } from 'react';
import { signupUser, signinUser, fetchCurrentUser } from '@/lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userName, setUserName] = useState(localStorage.getItem('user_name') || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUser() {
      const token = localStorage.getItem('access_token');
      if (token) {
        try {
          const userData = await fetchCurrentUser();
          setUser(userData);
          setUserName(userData.name);
          localStorage.setItem('user_name', userData.name);
        } catch (err) {
          console.error('Failed to restore user session:', err);
          logout();
        }
      }
      setLoading(false);
    }
    loadUser();
  }, []);

  useEffect(() => {
    const handleSessionExpired = () => logout();
    window.addEventListener('auth:session-expired', handleSessionExpired);
    return () => window.removeEventListener('auth:session-expired', handleSessionExpired);
  }, []);

  const login = async (phone_number, pin) => {
    const data = await signinUser(phone_number, pin);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user_name', data.user_name);
    setUserName(data.user_name);
    
    // Fetch full user object
    try {
      const userData = await fetchCurrentUser();
      setUser(userData);
    } catch {
      setUser({ name: data.user_name, phone_number });
    }
    return data;
  };

  const signup = async (name, phone_number, pin) => {
    const data = await signupUser(name, phone_number, pin);
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user_name', data.user_name);
    setUserName(data.user_name);

    try {
      const userData = await fetchCurrentUser();
      setUser(userData);
    } catch {
      setUser({ name: data.user_name, phone_number });
    }
    return data;
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_name');
    setUser(null);
    setUserName('');
  };

  return (
    <AuthContext.Provider value={{ user, userName, loading, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
