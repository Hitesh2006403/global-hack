import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import {
  HeartHandshake,
  UtensilsCrossed,
  Home,
  Bike,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  Eye,
  EyeOff,
  CheckCircle2,
  Building2,
  FileBadge2,
  Truck,
  KeyRound,
  Info,
} from 'lucide-react';

// Official 4-color Google G SVG logo
const GoogleIcon = ({ className = 'w-5 h-5' }) => (
  <svg className={className} viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
    />
  </svg>
);

// Configuration for each workspace role
const ROLES = [
  {
    role: 'donor',
    title: 'Food Donor',
    shortLabel: 'Donor',
    icon: UtensilsCrossed,
    color: 'from-amber-500 to-orange-600',
    hoverGlow: 'group-hover:shadow-amber-500/40 group-hover:border-amber-500/50',
    ambientColor: 'bg-amber-500/20',
    textColor: 'text-amber-400',
    accentBorder: 'border-amber-500/30',
    allowsGoogleAuth: true,
    customField: {
      name: 'fssaiNumber',
      label: 'FSSAI License / Kitchen Outlet ID',
      placeholder: 'e.g. FSSAI-21424010000492 or HYATT-BLR-01',
      helper: 'Mandatory Food Safety & Standards Authority registration for surplus food routing.',
      defaultValue: 'FSSAI-21424010000492',
      icon: FileBadge2,
    },
    demoUser: {
      name: 'Chef Marco Rossi',
      orgName: 'Grand Hyatt Banquet & Bistro',
      email: 'marco@grandhyatt.org',
      password: 'donor123',
    },
  },
  {
    role: 'recipient',
    title: 'Recipient Organization',
    shortLabel: 'Recipient',
    icon: Home,
    color: 'from-emerald-500 to-teal-600',
    hoverGlow: 'group-hover:shadow-emerald-500/40 group-hover:border-emerald-500/50',
    ambientColor: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
    accentBorder: 'border-emerald-500/30',
    allowsGoogleAuth: true,
    customField: {
      name: 'ngoRegId',
      label: 'NGO Darpan ID / Trust Registration Code',
      placeholder: 'e.g. NGO-KA-2023-0182 or DARPAN-88910',
      helper: 'Official government Darpan or NGO registration number for verified beneficiary aid.',
      defaultValue: 'NGO-KA-2023-0182',
      icon: Building2,
    },
    demoUser: {
      name: 'Sister Teresa Maria',
      orgName: 'Grace Hope Children Shelter',
      email: 'contact@gracehope.org',
      password: 'shelter123',
    },
  },
  {
    role: 'delivery',
    title: 'Delivery Partner',
    shortLabel: 'Delivery',
    icon: Bike,
    color: 'from-blue-500 to-indigo-600',
    hoverGlow: 'group-hover:shadow-blue-500/40 group-hover:border-blue-500/50',
    ambientColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    accentBorder: 'border-blue-500/30',
    allowsGoogleAuth: true,
    customField: {
      name: 'vehicleNumber',
      label: 'Vehicle Plate No. / Thermal Carrier ID',
      placeholder: 'e.g. KA-01-EQ-9872 or THERMAL-RIDER-42',
      helper: 'Registered cargo vehicle number and insulated thermal temperature carrier code.',
      defaultValue: 'KA-01-EQ-9872',
      icon: Truck,
    },
    demoUser: {
      name: 'Vikram Singh (Rider #42)',
      orgName: 'Rapid Thermal Rescue Fleet',
      email: 'vikram@shareaplate.org',
      password: 'rider123',
    },
  },
  {
    role: 'admin',
    title: 'Platform Admin',
    shortLabel: 'Admin',
    icon: ShieldAlert,
    color: 'from-rose-500 to-red-600',
    hoverGlow: 'group-hover:shadow-rose-500/40 group-hover:border-rose-500/50',
    ambientColor: 'bg-rose-500/20',
    textColor: 'text-rose-400',
    accentBorder: 'border-rose-500/30',
    allowsGoogleAuth: false, // Platform Admin requires secure administrator authentication and clearance key
    customField: {
      name: 'adminClearanceKey',
      label: 'Admin Clearance Key / 2FA Passcode',
      placeholder: 'e.g. ADM-SEC-9941 or 6-digit TOTP',
      helper: 'Level-4 cryptographic security token for centralized verification telemetry.',
      defaultValue: 'ADM-SEC-9941',
      icon: KeyRound,
    },
    demoUser: {
      name: 'Ananya Sharma (Ops Lead)',
      orgName: 'Central Operations Command',
      email: 'ops@shareaplate.org',
      password: 'admin123',
    },
  },
];

export const LoginPage = ({ onLoginSuccess, onContinueAsGuest }) => {
  const { login, loginWithGoogle, register } = useAuth();
  const { addToast } = useNotification();

  // State: selectedRole is null initially (simple logo options view),
  // once clicked, ONLY that role's login appears with premium look & effects!
  const [selectedRole, setSelectedRole] = useState(null);

  // Form mode: 'login' | 'register'
  const [formMode, setFormMode] = useState('login');

  // Form inputs
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleCustomField, setRoleCustomField] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Registration inputs
  const [regName, setRegName] = useState('');
  const [regOrg, setRegOrg] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regCustomField, setRegCustomField] = useState('');

  // Ref for rendering native Google Identity Services button
  const googleBtnContainerRef = useRef(null);

  // Current active role configuration
  const activeRole = ROLES.find((r) => r.role === selectedRole);

  // Initialize official Google Identity Services SDK when entering an individual portal that supports Google
  useEffect(() => {
    if (
      selectedRole &&
      activeRole?.allowsGoogleAuth &&
      formMode === 'login' &&
      typeof window !== 'undefined'
    ) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

      if (window.google?.accounts?.id && clientId && !clientId.includes('your-google-client-id')) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleGoogleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (googleBtnContainerRef.current) {
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              theme: 'filled_black',
              size: 'large',
              shape: 'pill',
              text: 'continue_with',
              width: '100%',
            });
          }
        } catch (e) {
          console.warn('Google Identity Services initialization notice:', e);
        }
      }
    }
  }, [selectedRole, formMode]);

  // Handle clicking a role logo option
  const handleSelectRole = (roleKey) => {
    setSelectedRole(roleKey);
    setFormMode('login');
    setErrors({});
    setEmail('');
    setPassword('');
    setRoleCustomField('');
  };

  // 1-Click Demo Fill for active role
  const handleAutofillDemo = () => {
    if (!activeRole) return;
    setEmail(activeRole.demoUser.email);
    setPassword(activeRole.demoUser.password);
    setRoleCustomField(activeRole.customField.defaultValue);
    setErrors({});
    addToast(`Auto-filled verified credentials for ${activeRole.demoUser.name}`, 'info');
  };

  // Login submit handler
  const handleRoleLogin = async (e) => {
    e.preventDefault();
    const newErrors = {};

    if (!email.trim()) newErrors.email = 'Email address is required.';
    if (!password) newErrors.password = 'Password is required.';
    if (!roleCustomField.trim()) {
      newErrors.customField = `${activeRole.customField.label} is required for verification.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please complete all required verification fields.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await login(email.trim(), password, {
        [activeRole.customField.name]: roleCustomField.trim(),
        role: activeRole.role,
      });

      addToast(
        `Welcome back! Signed in to ${activeRole.title} successfully.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Register submit handler
  const handleRoleRegister = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!regName.trim()) newErrors.regName = 'Full name is required.';
    if (!regOrg.trim()) newErrors.regOrg = 'Organization name is required.';
    if (!regEmail.trim()) newErrors.regEmail = 'Email address is required.';
    if (!regPassword || regPassword.length < 6)
      newErrors.regPassword = 'Password must be at least 6 characters.';
    if (!regCustomField.trim()) {
      newErrors.regCustomField = `${activeRole.customField.label} is required.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      addToast('Please complete all required registration fields.', 'warning');
      return;
    }

    try {
      setSubmitting(true);
      await register({
        name: regName.trim(),
        organizationName: regOrg.trim(),
        email: regEmail.trim(),
        password: regPassword,
        role: activeRole.role,
        phone: regPhone.trim() || '+91 99000 11223',
        [activeRole.customField.name]: regCustomField.trim(),
        address: 'Bengaluru Operations Hub',
      });

      addToast(
        `Registration complete! Welcome to ${activeRole.title}.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Real Google Identity Services (GIS) Callback - handles genuine Google ID token
  const handleGoogleCredentialResponse = async (response) => {
    if (!response?.credential) {
      addToast('Google authentication failed: no credential received.', 'error');
      return;
    }

    try {
      setGoogleAuthLoading(true);
      await loginWithGoogle(response.credential, activeRole.role, {
        [activeRole.customField.name]: roleCustomField.trim(),
      });

      addToast(
        `Google identity verified! Signed in to ${activeRole.title}.`,
        'success'
      );
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      addToast(err.message || 'Google token validation failed on server.', 'error');
    } finally {
      setGoogleAuthLoading(false);
    }
  };

  // Trigger Google Identity Services genuine OAuth 2.0 flow
  const handleTriggerGoogleOAuth = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!clientId || clientId.includes('your-google-client-id')) {
      addToast(
        'Google OAuth requires VITE_GOOGLE_CLIENT_ID in client/.env. Configure your Google Cloud Console Web Client ID.',
        'warning'
      );
      return;
    }

    if (!window.google?.accounts?.id) {
      addToast(
        'Google Identity Services is initializing. Please verify network access to accounts.google.com.',
        'info'
      );
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleCredentialResponse,
        cancel_on_tap_outside: true,
      });

      // Prompt the genuine Google Account Chooser
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One-Tap is suppressed, use standard OAuth token client popup
          if (window.google?.accounts?.oauth2) {
            const tokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: 'openid email profile',
              callback: async (tokenResponse) => {
                if (tokenResponse?.access_token) {
                  // Fallback to token validation
                  try {
                    setGoogleAuthLoading(true);
                    await loginWithGoogle(tokenResponse.access_token, activeRole.role, {
                      [activeRole.customField.name]: roleCustomField.trim(),
                    });
                    addToast(`Signed in via Google OAuth as ${activeRole.title}.`, 'success');
                    if (onLoginSuccess) onLoginSuccess();
                  } catch (err) {
                    addToast(err.message, 'error');
                  } finally {
                    setGoogleAuthLoading(false);
                  }
                }
              },
            });
            tokenClient.requestAccessToken();
          }
        }
      });
    } catch (err) {
      addToast(err.message || 'Failed to open Google sign-in dialog.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-zinc-950 to-neutral-950 text-white flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none">
      {/* Dynamic Ambient Glow Tailored to Active State */}
      <div
        className={`absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none transition-all duration-700 ${
          activeRole ? activeRole.ambientColor : 'bg-rose-600/10'
        }`}
      />
      <div className="absolute top-0 -left-20 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Center Container */}
      <div className="max-w-5xl w-full mx-auto relative z-10">
        {/* Minimalist Top Brand Header */}
        <div className="flex items-center justify-between mb-10 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-rose-600 via-amber-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-rose-600/20">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white">
                Share<span className="text-rose-500">A</span>Plate
              </span>
              <p className="text-[11px] text-zinc-400 font-medium">
                Verified Food Rescue & Handover Network
              </p>
            </div>
          </div>

          {onContinueAsGuest && (
            <button
              type="button"
              onClick={onContinueAsGuest}
              className="text-xs font-semibold text-zinc-400 hover:text-white transition flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10"
            >
              <span>Explore as Guest</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* =========================================================================
            STATE 1: CLEAN SELECT YOUR PORTAL PAGE
            Contains ONLY the ShareAPlate branding, heading, 4 role cards,
            and Explore as Guest. Entire bottom Google section completely removed.
           ========================================================================= */}
        {!selectedRole && (
          <div className="space-y-10 animate-fadeIn max-w-4xl mx-auto">
            {/* Minimalist Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-amber-300">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Choose Your Role</span>
              </div>
              <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
                Select Your Portal
              </h1>
              <p className="text-sm sm:text-base text-zinc-400 max-w-md mx-auto">
                Click a role icon below to open its dedicated dashboard login.
              </p>
            </div>

            {/* Clean, Simple 4 Logo Options */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {ROLES.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.role}
                    type="button"
                    onClick={() => handleSelectRole(item.role)}
                    className={`group relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-zinc-900/60 hover:bg-zinc-800/80 backdrop-blur-xl border border-white/10 hover:border-white/30 transition-all duration-300 hover:-translate-y-2.5 hover:shadow-2xl cursor-pointer ${item.hoverGlow}`}
                  >
                    {/* Glowing Logo Icon */}
                    <div
                      className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr ${item.color} text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300 relative`}
                    >
                      <Icon className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-md" />
                      <div className="absolute inset-0 rounded-3xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>

                    {/* Simple, Clean Role Name */}
                    <h3 className="mt-5 text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors text-center">
                      {item.title}
                    </h3>
                    <span className="text-[11px] font-semibold text-zinc-400 mt-1 uppercase tracking-wider group-hover:text-zinc-300">
                      {item.shortLabel}
                    </span>

                    {/* Subtle click indicator */}
                    <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px] font-bold text-white">
                      <span>Click to login</span>
                      <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =========================================================================
            STATE 2: THE PREMIUM INDIVIDUAL LOGIN PAGE (Appears on clicking a role logo)
            Google OAuth appears ONLY on permitted individual portals (Donor, Recipient, Delivery)
            Platform Admin uses dedicated Administrator Authentication & Clearance Key
           ========================================================================= */}
        {selectedRole && activeRole && (
          <div className="max-w-md sm:max-w-lg mx-auto animate-scaleUp">
            {/* Top Back Navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setErrors({});
                }}
                className="inline-flex items-center gap-2 text-xs font-bold text-zinc-300 hover:text-white bg-white/10 hover:bg-white/15 px-3.5 py-2 rounded-xl backdrop-blur-md border border-white/15 transition group"
              >
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                <span>← Back to Roles</span>
              </button>

              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${activeRole.color} text-white text-xs font-extrabold shadow-md`}
              >
                <activeRole.icon className="w-3.5 h-3.5" />
                <span>{activeRole.shortLabel}</span>
              </div>
            </div>

            {/* Premium Glassmorphism Login Card */}
            <div className="relative bg-zinc-900/90 backdrop-blur-2xl text-white rounded-3xl p-6 sm:p-9 shadow-2xl border border-white/15 overflow-hidden space-y-6">
              {/* Glowing decorative gradient aura inside card */}
              <div
                className={`absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br ${activeRole.color} opacity-25 rounded-full blur-3xl pointer-events-none`}
              />

              {/* Card Header with Glowing Role Logo */}
              <div className="flex items-center gap-4 border-b border-white/10 pb-5">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${activeRole.color} text-white flex items-center justify-center shadow-lg shadow-black/50 shrink-0`}
                >
                  <activeRole.icon className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                    {formMode === 'login'
                      ? `${activeRole.title} Login`
                      : `Register as ${activeRole.shortLabel}`}
                  </h2>
                  <p className="text-xs text-zinc-400 font-medium mt-0.5">
                    {formMode === 'login'
                      ? activeRole.allowsGoogleAuth
                        ? 'Enter your credentials or continue with Google'
                        : 'Restricted administrative command authentication'
                      : 'Join the verified food rescue network'}
                  </p>
                </div>
              </div>

              {/* Login vs Register Tabs */}
              <div className="flex p-1 bg-white/5 rounded-xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('login');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    formMode === 'login'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormMode('register');
                    setErrors({});
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
                    formMode === 'register'
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Register
                </button>
              </div>

              {/* GENUINE GOOGLE OAUTH SECTION (ONLY for portals where permitted: Donor, Recipient, Delivery) */}
              {formMode === 'login' && activeRole.allowsGoogleAuth && (
                <div className="space-y-4">
                  {/* Container for rendered Google Identity Services button */}
                  <div ref={googleBtnContainerRef} className="w-full min-h-[44px] flex justify-center" />

                  {/* Accessible Fallback / Custom Button trigger */}
                  <button
                    type="button"
                    onClick={handleTriggerGoogleOAuth}
                    disabled={googleAuthLoading}
                    className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-zinc-100 text-slate-900 font-extrabold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-3 active:scale-[0.99] group border border-white/20 cursor-pointer"
                  >
                    <GoogleIcon className="w-5 h-5 shrink-0" />
                    <span>
                      {googleAuthLoading
                        ? 'Validating Google Identity...'
                        : `Continue with Google as ${activeRole.shortLabel}`}
                    </span>
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-zinc-900 px-3 text-zinc-400 font-bold tracking-wider">
                        Or enter organizational credentials
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notice for Platform Admin (No public Google sign-in bypass) */}
              {formMode === 'login' && !activeRole.allowsGoogleAuth && (
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300">
                  <Info className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>
                    Platform Admin requires pre-authorized credentials and a cryptographic clearance key. Public Google SSO is restricted.
                  </span>
                </div>
              )}

              {/* -------------------------------------------------------------
                  MODE 1: LOGIN FORM WITH ROLE-SPECIFIC REQUIRED FIELD
                 ------------------------------------------------------------- */}
              {formMode === 'login' && (
                <form onSubmit={handleRoleLogin} className="space-y-4">
                  {/* ROLE SPECIFIC REQUIRED FIELD */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wide">
                        {activeRole.customField.label}{' '}
                        <span className="text-rose-500 font-black">*</span>
                      </label>
                      <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                        Required
                      </span>
                    </div>
                    <div className="relative">
                      <activeRole.customField.icon className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={roleCustomField}
                        onChange={(e) => {
                          setRoleCustomField(e.target.value);
                          if (errors.customField) {
                            setErrors({ ...errors, customField: null });
                          }
                        }}
                        placeholder={activeRole.customField.placeholder}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none font-mono text-white placeholder:text-zinc-500 ${
                          errors.customField
                            ? 'border-rose-500 bg-rose-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      />
                    </div>
                    {errors.customField ? (
                      <p className="text-[11px] text-rose-400 mt-1 font-semibold">
                        {errors.customField}
                      </p>
                    ) : (
                      <p className="text-[11px] text-zinc-400 mt-1">
                        {activeRole.customField.helper}
                      </p>
                    )}
                  </div>

                  {/* EMAIL ADDRESS */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wide mb-1">
                      Email Address <span className="text-rose-500 font-black">*</span>
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          if (errors.email) setErrors({ ...errors, email: null });
                        }}
                        placeholder={`e.g. ${activeRole.demoUser.email}`}
                        className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/5 border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none text-white placeholder:text-zinc-500 font-medium ${
                          errors.email
                            ? 'border-rose-500 bg-rose-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-[11px] text-rose-400 mt-1 font-semibold">
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* PASSWORD */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-bold text-zinc-200 uppercase tracking-wide">
                        Password <span className="text-rose-500 font-black">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          addToast(
                            `Demo Mode: Sign in using password "${activeRole.demoUser.password}" or click Autofill below.`,
                            'info'
                          )
                        }
                        className="text-[11px] text-rose-400 font-semibold hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (errors.password) setErrors({ ...errors, password: null });
                        }}
                        placeholder="Enter password..."
                        className={`w-full pl-10 pr-10 py-2.5 rounded-xl bg-white/5 border text-xs sm:text-sm focus:ring-2 focus:ring-rose-500 focus:outline-none text-white placeholder:text-zinc-500 ${
                          errors.password
                            ? 'border-rose-500 bg-rose-500/10'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-1"
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[11px] text-rose-400 mt-1 font-semibold">
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Remember Me Checkbox */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer select-none text-zinc-400 hover:text-zinc-200">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded-sm border-white/20 bg-white/5 text-rose-600 focus:ring-rose-500"
                      />
                      <span className="font-medium">Remember for 30 days</span>
                    </label>

                    <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>256-Bit Encrypted</span>
                    </div>
                  </div>

                  {/* PREMIUM GLOWING SUBMIT BUTTON */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${activeRole.color} text-white font-black text-sm shadow-lg hover:shadow-xl hover:brightness-110 transition-all duration-200 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer`}
                  >
                    <span>
                      {submitting
                        ? `Signing in to ${activeRole.shortLabel}...`
                        : `Sign In to ${activeRole.title}`}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  {/* CLEAN AUTOFILL DEMO PILL */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleAutofillDemo}
                      className="w-full py-2.5 px-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        Testing? <strong className="text-white">Autofill verified {activeRole.demoUser.name} credentials</strong>
                      </span>
                    </button>
                  </div>
                </form>
              )}

              {/* -------------------------------------------------------------
                  MODE 2: REGISTRATION FORM FOR SELECTED ROLE
                 ------------------------------------------------------------- */}
              {formMode === 'register' && (
                <form onSubmit={handleRoleRegister} className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                        Coordinator Name *
                      </label>
                      <input
                        type="text"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        placeholder="e.g. Ramesh Patel"
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regName && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{errors.regName}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                        Organization / Branch *
                      </label>
                      <input
                        type="text"
                        value={regOrg}
                        onChange={(e) => setRegOrg(e.target.value)}
                        placeholder="e.g. Royal Kitchens"
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regOrg && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{errors.regOrg}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                      {activeRole.customField.label} *
                    </label>
                    <input
                      type="text"
                      value={regCustomField}
                      onChange={(e) => setRegCustomField(e.target.value)}
                      placeholder={activeRole.customField.placeholder}
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                    {errors.regCustomField ? (
                      <p className="text-[10px] text-rose-400 mt-0.5">{errors.regCustomField}</p>
                    ) : (
                      <p className="text-[10px] text-zinc-400 mt-0.5">
                        {activeRole.customField.helper}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="contact@org.com"
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regEmail && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{errors.regEmail}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder="Min 6 characters"
                        className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                      />
                      {errors.regPassword && (
                        <p className="text-[10px] text-rose-400 mt-0.5">{errors.regPassword}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-200 uppercase mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="+91 98765 43210"
                      className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:ring-2 focus:ring-rose-500 focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-3 rounded-2xl bg-gradient-to-r ${activeRole.color} text-white font-bold text-xs sm:text-sm shadow-md transition flex items-center justify-center gap-1.5 mt-2 hover:brightness-110 active:scale-[0.98] cursor-pointer`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {submitting
                        ? 'Registering partner...'
                        : `Register as Verified ${activeRole.shortLabel}`}
                    </span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
