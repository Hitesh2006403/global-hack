import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  HeartHandshake,
  UtensilsCrossed,
  Home,
  Bike,
  ShieldAlert,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

export const AuthModal = ({ isOpen, onClose }) => {
  const { login, register, switchRole, allUsers } = useAuth();
  const { addToast } = useNotification();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [selectedRole, setSelectedRole] = useState('donor');
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleQuickDemoLogin = (user) => {
    switchRole(user.role);
    addToast(`Signed in as ${user.name} (${user.role.toUpperCase()})`, 'success');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      if (isRegister) {
        await register({
          email,
          name,
          organizationName: orgName || name,
          phone: phone || '+91 99000 88776',
          address: address || 'Bengaluru Central',
          role: selectedRole,
        });
        addToast('Registration successful! Welcome to Share A Plate.', 'success');
      } else {
        await login(email, password);
        addToast('Welcome back!', 'success');
      }
      onClose();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 to-amber-500 p-6 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-3 shadow-inner">
            <HeartHandshake className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black tracking-tight">Share A Plate</h3>
          <p className="text-xs text-rose-100 mt-1">
            {isRegister ? 'Create Partner Account' : 'Sign in to Continue'}
          </p>
        </div>

        {/* Fast Demo One-Click Personas */}
        <div className="p-6 pb-2 border-b border-slate-100 bg-slate-50/60">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Fast One-Click Demo Personas:</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {allUsers?.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleQuickDemoLogin(u)}
                className="text-left p-2 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:bg-amber-50/50 transition"
              >
                <div className="text-xs font-bold text-slate-800 truncate">{u.name}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wide font-semibold">
                  {u.role}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Custom Auth Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="flex border-b border-slate-200">
            <button
              type="button"
              onClick={() => setIsRegister(false)}
              className={`flex-1 pb-2 text-xs font-bold ${
                !isRegister ? 'border-b-2 border-rose-600 text-rose-600' : 'text-slate-400'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsRegister(true)}
              className={`flex-1 pb-2 text-xs font-bold ${
                isRegister ? 'border-b-2 border-rose-600 text-rose-600' : 'text-slate-400'
              }`}
            >
              Register New
            </button>
          </div>

          {isRegister && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Select Role
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'donor', label: 'Donor' },
                    { id: 'recipient', label: 'Shelter' },
                    { id: 'delivery', label: 'Rider' },
                    { id: 'admin', label: 'Admin' },
                  ].map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRole(r.id)}
                      className={`py-1.5 rounded-lg text-xs font-bold border transition ${
                        selectedRole === r.id
                          ? 'bg-rose-50 border-rose-400 text-rose-700'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Full Name / Contact Person
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Rahul Verma"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  placeholder="e.g. Sunrise Bakery / Hope Foundation"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50"
            >
              {submitting ? 'Please wait...' : isRegister ? 'Register Account' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
