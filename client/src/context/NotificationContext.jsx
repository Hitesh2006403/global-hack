import React, { createContext, useContext, useState, useCallback } from 'react';
import { playChime } from '../utils/soundUtils';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [activeVoiceCall, setActiveVoiceCall] = useState(null);

  const addToast = useCallback((message, type = 'info', duration = 4500) => {
    const id = Date.now() + Math.random().toString(36).substring(2, 6);
    const newToast = { id, message, type, timestamp: new Date() };

    setNotifications((prev) => [newToast, ...prev]);
    playChime(type === 'urgent' ? 'urgent' : type === 'success' ? 'success' : 'notification');

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // AI Voice-Call Simulation feature (required by prompt)
  const triggerAiVoiceCall = useCallback((callData) => {
    playChime('urgent');
    setActiveVoiceCall({
      id: 'call-' + Date.now(),
      recipientPhone: callData.recipientPhone || '+91 91234 56789',
      recipientName: callData.recipientName || 'Grace Hope Shelter Coordinator',
      foodName: callData.foodName || 'Executive Buffet Meals (45 servings)',
      expiryLeft: callData.expiryLeft || '1h 15m remaining',
      transcript:
        callData.transcript ||
        'Hello Sister Teresa, this is the Share A Plate automated AI dispatch assistant. A fresh hot meal donation of 45 servings is available 1.2km away at Grand Hyatt. Donor requested immediate pickup within 45 minutes. Would you like to reserve this batch?',
      status: 'RINGING', // RINGING -> CONNECTED -> COMPLETED
    });
  }, []);

  const dismissVoiceCall = useCallback(() => {
    setActiveVoiceCall(null);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addToast,
        removeToast,
        activeVoiceCall,
        triggerAiVoiceCall,
        setActiveVoiceCall,
        dismissVoiceCall,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};
