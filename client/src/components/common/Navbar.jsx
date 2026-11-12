import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import {
  HeartHandshake,
  UtensilsCrossed,
  Home,
  Bike,
  ShieldAlert,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { api } from '../../services/api';

export const Navbar = ({ onOpenCreateDonation, onOpenPostRequirement, onOpenLogin }) => {
  const { currentUser, role, switchRole } = useAuth();
  const { impactMetrics } = useDonations();

  const handleResetData = () => {
    if (window.confirm('Reset all demo data back to default state?')) {
      api.resetDemoData();
      window.location.reload();
    }
  };

  const ROLES = [
    {
      id: 'donor',
      label: 'Donor',
      icon: UtensilsCrossed,
      activeColor: 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/30',
      iconColor: 'text-amber-500',
    },
    {
      id: 'recipient',
      label: 'Recipient',
      icon: Home,
      activeColor: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30',
      iconColor: 'text-emerald-500',
    },
    {
      id: 'delivery',
      label: 'Delivery Agent',
      icon: Bike,
      activeColor: 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30',
      iconColor: 'text-blue-500',
    },
    {
      id: 'admin',
      label: 'Admin',
      icon: ShieldAlert,
      activeColor: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/30',
      iconColor: 'text-rose-500',
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-xs">
      <div className="max-w-[1680px] w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Navbar Top Row - Strictly No Scrollbar, Elements Beside Each Other */}
        <div className="flex items-center justify-between h-20 gap-3 lg:gap-6">
          {/* 1. Left: Brand Logo & Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-400 flex items-center justify-center text-white shadow-md shadow-rose-600/20">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xl tracking-tight text-slate-900">
                  Share<span className="text-rose-600">A</span>Plate
                </span>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-extrabold px-2 py-0.5 rounded-full tracking-wider uppercase border border-amber-300">
                  v1.0 MVP
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Share More, Waste Less • Food Rescue Engine
              </p>
            </div>
          </div>

          {/* 2. Center: Prominent Role Switcher (Beside each other, perfectly fitted, NO scroll effect) */}
          <div className="flex items-center justify-center flex-1 max-w-2xl px-2">
            <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-center gap-1 sm:gap-1.5 w-full">
              {ROLES.map((r) => {
                const Icon = r.icon;
                const isActive = role === r.id;
                return (
                  <button
                    key={r.id}
                    onClick={() => switchRole(r.id)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 px-2.5 sm:px-4 rounded-xl font-bold transition-all duration-200 text-xs sm:text-sm whitespace-nowrap ${
                      isActive
                        ? r.activeColor
                        : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80 shadow-2xs'
                    }`}
                    title={`Switch to ${r.label}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : r.iconColor}`} />
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Right: Impact Counter & Quick Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Impact Counter */}
            <div className="hidden xl:flex items-center gap-2 bg-emerald-50 border border-emerald-300 text-emerald-900 px-3.5 py-2 rounded-xl text-xs font-bold shadow-2xs">
              <Sparkles className="w-4 h-4 text-emerald-600 animate-pulse" />
              <span>{impactMetrics?.totalMealsRescued?.toLocaleString() || '4,892'} Meals Rescued</span>
            </div>

            {/* Quick action button depending on role */}
            {role === 'donor' && (
              <button
                onClick={onOpenCreateDonation}
                className="bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md shadow-rose-600/30 active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>+ Post Food Surplus</span>
              </button>
            )}

            {role === 'recipient' && (
              <button
                onClick={onOpenPostRequirement}
                className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md shadow-emerald-600/30 active:scale-95 transition flex items-center gap-1.5 whitespace-nowrap"
              >
                <Home className="w-4 h-4" />
                <span>+ Post Requirement</span>
              </button>
            )}

            {/* Member Login & Credentials Portal */}
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 border border-slate-200 text-slate-800 text-xs font-bold transition shadow-2xs"
              title="Sign in with 4 Member Credentials (Donor, Recipient, Delivery, Admin)"
            >
              <UserCheck className="w-4 h-4 text-rose-600" />
              <span className="hidden sm:inline">Member Login</span>
            </button>

            {/* Reset Demo button for quick re-testing */}
            <button
              onClick={handleResetData}
              title="Reset Demo Data"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition border border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* User Identity subbar */}
        <div className="py-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Session:
            </span>
            {currentUser?.avatar && (
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-5 h-5 rounded-full object-cover ring-1 ring-slate-300"
              />
            )}
            <span className="font-extrabold text-slate-900">
              {currentUser?.organizationName || currentUser?.name}
            </span>
            {currentUser?.googleVerified && (
              <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                Google SSO
              </span>
            )}
            <span className="text-slate-400 hidden sm:inline">•</span>
            <span className="text-slate-500 hidden sm:inline font-medium">
              {currentUser?.address || 'Bengaluru Core Area'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-[11px] text-slate-400 italic">
              {role === 'donor' && 'Posting surplus batches & monitoring live expiry countdowns'}
              {role === 'recipient' && 'Requesting food & smart match recommendations'}
              {role === 'delivery' && 'Active pickup milestones & QR handover checks'}
              {role === 'admin' && 'Central platform impact & live donation monitoring'}
            </span>
            <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Verified Partner
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
