import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import logoImage from '../assets/logo image.png'
import { api } from '../services/api'

const roleOptions = [
  {
    label: 'Donor',
    value: 'donor',
    description: 'Restaurant, hostel, event organizer or commercial kitchen with surplus food.',
    presetEmail: 'donor@shareaplate.org',
    presetName: 'Vikram Sharma',
    presetOrg: 'Skyline Bistro & Catering',
  },
  {
    label: 'Recipient',
    value: 'recipient',
    description: 'NGO, night shelter, orphanage, community kitchen or food charity.',
    presetEmail: 'recipient@shareaplate.org',
    presetName: 'Sister Riya Joseph',
    presetOrg: 'New Dawn Night Shelter',
  },
  {
    label: 'Delivery Agent',
    value: 'delivery',
    description: 'Logistics coordinator, driver, or volunteer for food pickup & handover.',
    presetEmail: 'delivery@shareaplate.org',
    presetName: 'Karthik Nambiar',
    presetOrg: 'ShareAPlate Express Logistics',
  },
  {
    label: 'Admin',
    value: 'admin',
    description: 'Platform supervisor for audit compliance, safety alerts, and KPIs.',
    presetEmail: 'admin@shareaplate.org',
    presetName: 'Kavya Murthy',
    presetOrg: 'Share A Plate Foundation',
  },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const [selectedRole, setSelectedRole] = useState('donor')
  const [isRegistering, setIsRegistering] = useState(false)
  const [profile, setProfile] = useState({
    fullName: 'Vikram Sharma',
    email: 'donor@shareaplate.org',
    organization: 'Skyline Bistro & Catering',
    password: 'donor123',
    phone: '+91 98989 11222',
    address: '14, 5th Cross, Koramangala 4th Block, Bengaluru',
  })
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const handleRoleChange = (nextRole) => {
    setSelectedRole(nextRole)
    const opt = roleOptions.find((r) => r.value === nextRole)
    if (opt) {
      setProfile((prev) => ({
        ...prev,
        fullName: opt.presetName,
        email: opt.presetEmail,
        organization: opt.presetOrg,
        password: `${opt.value}123`,
      }))
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setProfile((previous) => ({ ...previous, [name]: value }))
  }

  const handleQuickDemoLogin = async (roleKey) => {
    const opt = roleOptions.find((r) => r.value === roleKey)
    if (!opt) return
    setLoading(true)
    setErrorMessage('')
    try {
      await api.login(opt.presetEmail, `${roleKey}123`, roleKey)
      setLoading(false)
      navigate(`/dashboard?role=${roleKey}`)
    } catch (err) {
      setLoading(false)
      setErrorMessage(err.message || 'Login failed.')
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setErrorMessage('')

    const trimmedFullName = profile.fullName.trim()
    const trimmedEmail = profile.email.trim()
    const trimmedOrganization = profile.organization.trim()
    const trimmedPassword = profile.password.trim()

    if (!trimmedFullName || !trimmedEmail || !trimmedOrganization || !trimmedPassword) {
      setErrorMessage('Please fill in all required fields.')
      return
    }

    setLoading(true)
    try {
      if (isRegistering) {
        await api.register({
          fullName: trimmedFullName,
          email: trimmedEmail,
          organization: trimmedOrganization,
          password: trimmedPassword,
          role: selectedRole,
          phone: profile.phone,
          address: profile.address,
        })
      } else {
        await api.login(trimmedEmail, trimmedPassword, selectedRole)
      }
      setLoading(false)
      navigate(`/dashboard?role=${selectedRole}`)
    } catch (err) {
      setLoading(false)
      setErrorMessage(err.message || 'Authentication failed. Please verify credentials.')
    }
  }

  return (
    <div className="app-shell">
      {/* Top Navbar */}
      <header className="topbar compact-topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-label="Share A Plate logo">
            <img src={logoImage} alt="Share A Plate logo" className="brand-logo-image" />
          </div>
          <div className="brand-text">
            <span className="brand-name">
              <span className="brand-name-main">Share</span> <span className="brand-name-accent">A Plate</span>
            </span>
            <span className="brand-tag">Food Recovery & Matching Network</span>
          </div>
        </div>

        <nav className="main-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it Works</a>
          <a href="#matching-system">Smart Matching</a>
          <a href="#impact">Impact</a>
          <a href="#demo-access">Quick Demo Access</a>
        </nav>

        <a href="#login-form" className="nav-button get-started-button">
          Sign In
        </a>
      </header>

      {/* Main Hero & Auth Shell */}
      <main className="landing-main">
        <section className="hero-layout">
          <div className="hero-copy">
            <span className="eyebrow">Production-Grade Food Coordination</span>
            <h1>Connect surplus food with verified organizations in real time.</h1>
            <p>
              Share A Plate coordinates food donations based on quantity, category, dietary compatibility,
              geographic proximity, and safe-consumption expiry deadlines.
            </p>

            {/* Quick Demo Access Bar */}
            <div className="quick-access-box" id="demo-access">
              <span className="quick-access-label">⚡ 1-Click Fast Role Sign-In:</span>
              <div className="quick-pill-group">
                <button
                  type="button"
                  className="quick-role-pill donor-pill"
                  onClick={() => handleQuickDemoLogin('donor')}
                >
                  👨‍🍳 Donor (Skyline Bistro)
                </button>
                <button
                  type="button"
                  className="quick-role-pill recipient-pill"
                  onClick={() => handleQuickDemoLogin('recipient')}
                >
                  🏢 Recipient (New Dawn Shelter)
                </button>
                <button
                  type="button"
                  className="quick-role-pill delivery-pill"
                  onClick={() => handleQuickDemoLogin('delivery')}
                >
                  🚚 Delivery Agent
                </button>
                <button
                  type="button"
                  className="quick-role-pill admin-pill"
                  onClick={() => handleQuickDemoLogin('admin')}
                >
                  🛡 Admin Portal
                </button>
              </div>
            </div>

            <div className="hero-stats">
              <div>
                <strong>100%</strong>
                <span>Backend Driven</span>
              </div>
              <div>
                <strong>6-Factor</strong>
                <span>Matching Engine</span>
              </div>
              <div>
                <strong>ACID</strong>
                <span>Transactional Safety</span>
              </div>
            </div>
          </div>

          {/* Auth Panel */}
          <div className="auth-panel auth-panel-compact" id="login-form">
            <div className="auth-header-box">
              <h2>{isRegistering ? 'Register Account' : `${roleOptions.find((r) => r.value === selectedRole)?.label} Login`}</h2>
              <p>{roleOptions.find((r) => r.value === selectedRole)?.description}</p>
            </div>

            {errorMessage && <div className="modal-alert-error">{errorMessage}</div>}

            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                Portal Role
                <select
                  value={selectedRole}
                  onChange={(event) => handleRoleChange(event.target.value)}
                  required
                >
                  {roleOptions.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>

              {isRegistering && (
                <label>
                  Full name
                  <input
                    type="text"
                    name="fullName"
                    value={profile.fullName}
                    onChange={handleChange}
                    placeholder="Enter your full name"
                    required
                  />
                </label>
              )}

              <label>
                Email address
                <input
                  type="email"
                  name="email"
                  value={profile.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                  required
                />
              </label>

              {isRegistering && (
                <label>
                  Organization / area
                  <input
                    type="text"
                    name="organization"
                    value={profile.organization}
                    onChange={handleChange}
                    placeholder="e.g. Skyline Bistro, Koramangala"
                    required
                  />
                </label>
              )}

              <label>
                Password
                <input
                  type="password"
                  name="password"
                  value={profile.password}
                  onChange={handleChange}
                  placeholder="Enter password"
                  required
                />
              </label>

              <button type="submit" className="primary-button full-width" disabled={loading}>
                {loading
                  ? 'Verifying...'
                  : isRegistering
                  ? 'Complete Registration'
                  : `Sign In as ${roleOptions.find((r) => r.value === selectedRole)?.label}`}
              </button>

              <div className="auth-footer-toggle">
                <button
                  type="button"
                  className="text-toggle-btn"
                  onClick={() => setIsRegistering(!isRegistering)}
                >
                  {isRegistering
                    ? 'Already have an account? Sign In'
                    : "Need a new account? Register here"}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>
    </div>
  )
}
