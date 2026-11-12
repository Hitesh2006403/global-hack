import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { DonationProvider } from './context/DonationContext';
import { Navbar } from './components/common/Navbar';
import { UrgentTicker } from './components/common/UrgentTicker';
import { ToastContainer } from './components/common/ToastContainer';
import { AiVoiceCallModal } from './components/common/AiVoiceCallModal';
import { DonorDashboard } from './pages/DonorDashboard';
import { RecipientDashboard } from './pages/RecipientDashboard';
import { DeliveryDashboard } from './pages/DeliveryDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { AuthModal } from './pages/AuthPage';
import { LoginPage } from './pages/LoginPage';
import {
  HeartHandshake,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  MapPin,
  Utensils,
} from 'lucide-react';

function DashboardRouter() {
  const { role } = useAuth();
  const [isCreateDonationOpen, setIsCreateDonationOpen] = useState(false);
  const [isPostReqOpen, setIsPostReqOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoginPageVisible, setIsLoginPageVisible] = useState(false);

  if (isLoginPageVisible) {
    return (
      <LoginPage
        onLoginSuccess={() => setIsLoginPageVisible(false)}
        onContinueAsGuest={() => setIsLoginPageVisible(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* Real-Time Urgency Ticker Marquee */}
      <UrgentTicker />

      {/* Main Navbar */}
      <Navbar
        onOpenCreateDonation={() => setIsCreateDonationOpen(true)}
        onOpenPostRequirement={() => setIsPostReqOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenLogin={() => setIsLoginPageVisible(true)}
      />

      {/* Main Application Content Body */}
      <main className="flex-1 max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-10 py-6">
        {role === 'donor' && (
          <DonorDashboard
            isCreateOpen={isCreateDonationOpen}
            setIsCreateOpen={setIsCreateDonationOpen}
          />
        )}

        {role === 'recipient' && (
          <RecipientDashboard
            isPostReqOpen={isPostReqOpen}
            setIsPostReqOpen={setIsPostReqOpen}
          />
        )}

        {role === 'delivery' && <DeliveryDashboard />}

        {role === 'admin' && <AdminDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-8 text-xs text-slate-500">
        <div className="max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs">
              <HeartHandshake className="w-4 h-4" />
            </div>
            <span className="font-bold text-slate-700">Share A Plate</span>
            <span>— Share More, Waste Less</span>
          </div>

          <div className="flex items-center gap-4 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              Verified FSSAI / Food Safety Protocols
            </span>
            <span>•</span>
            <button
              onClick={() => setIsLoginPageVisible(true)}
              className="text-rose-600 font-bold hover:underline"
            >
              Switch Member / Sign In
            </button>
          </div>
        </div>
      </footer>

      {/* Real-Time Toast Notifications */}
      <ToastContainer />

      {/* Simulated AI Voice Call Modal */}
      <AiVoiceCallModal />

      {/* Authentication & Role Onboarding Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <DonationProvider>
          <DashboardRouter />
        </DonationProvider>
      </AuthProvider>
    </NotificationProvider>
  );
}
