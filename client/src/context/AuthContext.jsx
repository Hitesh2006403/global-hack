import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const serverUser = await api.getMe();
        if (serverUser) {
          setCurrentUser(serverUser);
          setLoading(false);
          return;
        }
      } catch {
        // Fall back to local storage
      }
      const user = api.getCurrentUser();
      setCurrentUser(user);
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password, extraData = {}) => {
    const res = await api.login(email, password);
    const updatedUser = {
      ...res.user,
      ...extraData,
    };
    localStorage.setItem('sap_current_user_v1', JSON.stringify(updatedUser));
    setCurrentUser(updatedUser);
    return updatedUser;
  };

  // Genuine Google OAuth 2.0 Login via server-side token validation
  const loginWithGoogle = async (credential, targetRole = 'donor', portalVerificationData = {}) => {
    const res = await api.loginWithGoogle(credential, targetRole, portalVerificationData);
    setCurrentUser(res.user);
    return res.user;
  };

  const register = async (userData) => {
    const res = await api.register(userData);
    setCurrentUser(res.user);
    return res.user;
  };

  const logout = async () => {
    await api.logoutSession();
    localStorage.removeItem('sap_current_user_v1');
    const allUsers = api.getAllUsers();
    setCurrentUser(allUsers[0]);
  };

  // Switch role seamlessly (ideal for hackathon presentation and testing all 4 roles)
  const switchRole = (targetRole) => {
    const allUsers = api.getAllUsers();
    const match = allUsers.find((u) => u.role === targetRole);
    if (match) {
      const switched = api.switchUser(match.id);
      setCurrentUser(switched);
      return switched;
    }
  };

  const allUsers = api.getAllUsers();

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        role: currentUser?.role || 'donor',
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        switchRole,
        allUsers,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
