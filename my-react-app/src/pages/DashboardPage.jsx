import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import logoImage from '../assets/logo image.png'
import { api } from '../services/api'
import CreateDonationModal from '../components/CreateDonationModal'
import CreateRequirementModal from '../components/CreateRequirementModal'
import AcceptDonationModal from '../components/AcceptDonationModal'
import MatchDetailsModal from '../components/MatchDetailsModal'
import NotificationDrawer from '../components/NotificationDrawer'

const ROLE_INFO = {
  donor: {
    label: 'Donor',
    header: 'Donor Portal',
    subtitle: 'Publish surplus food, review intelligent recipient matches, and coordinate pickup before safe-consumption expiry.',
  },
  recipient: {
    label: 'Recipient',
    header: 'Recipient Organization Portal',
    subtitle: 'Post nutritional requirements, explore AI-matched donations, accept allocations, and schedule timely pickups.',
  },
  delivery: {
    label: 'Delivery Agent',
    header: 'Logistics & Transit Dashboard',
    subtitle: 'Track scheduled pickups, verify food safety handovers, update transit milestones, and ensure prompt delivery.',
  },
  admin: {
    label: 'Admin',
    header: 'Platform Administration & Audit',
    subtitle: 'Monitor network performance, match integrity, auto-expired items, and end-to-end traceability.',
  },
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const [currentUser, setCurrentUser] = useState(() => api.getCurrentUser())
  const roleFromQuery = searchParams.get('role')
  const activeRole = roleFromQuery || currentUser?.role || location.state?.role || 'donor'

  // Modal states
  const [isCreateDonationOpen, setIsCreateDonationOpen] = useState(false)
  const [isCreateRequirementOpen, setIsCreateRequirementOpen] = useState(false)
  const [isAcceptModalOpen, setIsAcceptModalOpen] = useState(false)
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  // Selection states
  const [selectedDonation, setSelectedDonation] = useState(null)
  const [selectedRequirement, setSelectedRequirement] = useState(null)
  const [selectedMatch, setSelectedMatch] = useState(null)

  // Tab state
  const [activeTab, setActiveTab] = useState('main')

  // Data states
  const [myDonations, setMyDonations] = useState([])
  const [allDonations, setAllDonations] = useState([])
  const [donationHistory, setDonationHistory] = useState([])
  const [myRequirements, setMyRequirements] = useState([])
  const [allRequirements, setAllRequirements] = useState([])
  const [smartMatches, setSmartMatches] = useState([])
  const [pickups, setPickups] = useState([])
  const [dashboardStats, setDashboardStats] = useState(null)
  const [unreadNotifs, setUnreadNotifs] = useState(0)
  const [loading, setLoading] = useState(false)
  const [actionMessage, setActionMessage] = useState('')

  // Sync role to query param
  useEffect(() => {
    if (searchParams.get('role') !== activeRole) {
      setSearchParams({ role: activeRole }, { replace: true })
    }
  }, [activeRole, searchParams, setSearchParams])

  // Load Unread Notifications Count
  const loadNotifCount = useCallback(async () => {
    try {
      const res = await api.getNotifications()
      setUnreadNotifs(res.unreadCount || 0)
    } catch {
      // ignore
    }
  }, [])

  // Master Data Loader based on Active Role
  const loadDashboardData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Stats
      const statsRes = await api.getDashboardStats().catch(() => ({ stats: {} }))
      setDashboardStats(statsRes.stats || {})

      // 2. Role-specific data
      if (activeRole === 'donor') {
        const [myDons, histDons, reqs] = await Promise.all([
          api.getMyDonations().catch(() => ({ donations: [] })),
          api.getDonationHistory().catch(() => ({ history: [] })),
          api.getRequirements().catch(() => ({ requirements: [] })),
        ])
        setMyDonations(myDons.donations || [])
        setDonationHistory(histDons.history || [])
        setAllRequirements(reqs.requirements || [])

        // If donor has active donations, load matches for the first one
        if (myDons.donations?.length > 0) {
          const matchRes = await api.getMatchesForDonation(myDons.donations[0].id).catch(() => ({ matches: [] }))
          setSmartMatches(matchRes.matches || [])
        }
      } else if (activeRole === 'recipient') {
        const [myReqs, availDons, histDons] = await Promise.all([
          api.getMyRequirements().catch(() => ({ requirements: [] })),
          api.getDonations().catch(() => ({ donations: [] })),
          api.getDonationHistory().catch(() => ({ history: [] })),
        ])
        setMyRequirements(myReqs.requirements || [])
        setAllDonations(availDons.donations || [])
        setDonationHistory(histDons.history || [])

        // If recipient has active requirements, compute smart matches for the top requirement
        if (myReqs.requirements?.length > 0) {
          const activeReq = myReqs.requirements[0]
          const matchRes = await api.getMatchesForRequirement(activeReq.id).catch(() => ({ matches: [] }))
          setSmartMatches(matchRes.matches || [])
        } else {
          setSmartMatches([])
        }
      }

      // Pickups for logistics & tracking
      const pickupRes = await api.getPickups().catch(() => ({ pickups: [] }))
      setPickups(pickupRes.pickups || [])

      await loadNotifCount()
      setLoading(false)
    } catch (err) {
      console.error('Data load error:', err)
      setLoading(false)
    }
  }, [activeRole, loadNotifCount])

  useEffect(() => {
    loadDashboardData()
  }, [loadDashboardData])

  // Flash action notification
  const notifyUser = (msg) => {
    setActionMessage(msg)
    setTimeout(() => setActionMessage(''), 6000)
  }

  // Handle Role Switch
  const switchRole = (newRole) => {
    setSearchParams({ role: newRole })
    setActiveTab('main')
  }

  // Handle Cancel Donation
  const handleCancelDonation = async (donationId) => {
    if (!window.confirm('Are you sure you want to cancel this food donation?')) return
    try {
      await api.cancelDonation(donationId)
      notifyUser('Donation has been cancelled.')
      loadDashboardData()
    } catch (err) {
      alert(err.message || 'Failed to cancel donation.')
    }
  }

  // Handle Pickup Status Milestone
  const handleUpdatePickup = async (pickupId, nextStatus) => {
    try {
      await api.updatePickupStatus(pickupId, nextStatus, `Updated by ${currentUser?.fullName || 'agent'}`)
      notifyUser(`Pickup status transitioned to "${nextStatus.replace('_', ' ').toUpperCase()}".`)
      loadDashboardData()
    } catch (err) {
      alert(err.message || 'Failed to update pickup status.')
    }
  }

  // Open Acceptance Flow
  const handleOpenAcceptance = (donation, match = null, requirement = null) => {
    setSelectedDonation(donation)
    setSelectedMatch(match)
    // Find matching requirement or pick first active requirement
    const req = requirement || myRequirements.find((r) => ['open', 'partially_matched'].includes(r.status)) || null
    setSelectedRequirement(req)
    setIsAcceptModalOpen(true)
  }

  // Open Match Breakdown
  const handleOpenMatchDetails = (match) => {
    setSelectedMatch(match)
    setIsMatchModalOpen(true)
  }

  const roleMeta = ROLE_INFO[activeRole] || ROLE_INFO.donor

  return (
    <div className="app-shell">
      {/* Top Navigation Bar */}
      <header className="topbar dashboard-topbar">
        <div className="brand-wrap">
          <div className="brand-mark dashboard-avatar-small" aria-label="Share A Plate logo">
            <img src={logoImage} alt="Share A Plate logo" className="brand-logo-image" />
          </div>
          <div className="brand-text">
            <span className="brand-name">
              <span className="brand-name-main">Share</span> <span className="brand-name-accent">A Plate</span>
            </span>
            <span className="brand-tag">Food Recovery & Matching System</span>
          </div>
        </div>

        {/* Global Role Switcher */}
        <div className="role-switcher-pills">
          {Object.entries(ROLE_INFO).map(([key, info]) => (
            <button
              key={key}
              type="button"
              className={`role-pill ${activeRole === key ? 'active' : ''}`}
              onClick={() => switchRole(key)}
            >
              {info.label}
            </button>
          ))}
        </div>

        {/* Header Right Actions */}
        <div className="topbar-right-actions">
          {/* Notification Bell */}
          <button
            type="button"
            className="notif-bell-button"
            onClick={() => setIsNotifOpen(true)}
            aria-label="Open notifications"
          >
            🔔
            {unreadNotifs > 0 && <span className="notif-badge">{unreadNotifs}</span>}
          </button>

          {/* User Profile Pill */}
          <div className="user-profile-pill">
            <div className="avatar-dot"></div>
            <div className="profile-text">
              <span className="profile-name">{currentUser?.fullName || 'Authenticated User'}</span>
              <span className="profile-org">{currentUser?.organization || roleMeta.label}</span>
            </div>
          </div>

          <button
            type="button"
            className="nav-button dashboard-logout-button small-logout"
            onClick={() => {
              api.logout()
              navigate('/')
            }}
          >
            Logout
          </button>
        </div>
      </header>

      {/* Action Banner Message */}
      {actionMessage && (
        <div className="global-toast-banner">
          <span>✓ {actionMessage}</span>
          <button type="button" onClick={() => setActionMessage('')}>✕</button>
        </div>
      )}

      {/* Portal Hero & Quick Actions */}
      <section className="portal-hero-banner">
        <div className="portal-hero-content">
          <span className="portal-badge-label">{roleMeta.label.toUpperCase()} PORTAL</span>
          <h1>{roleMeta.header}</h1>
          <p>{roleMeta.subtitle}</p>
        </div>

        <div className="portal-cta-group">
          {activeRole === 'donor' && (
            <button
              type="button"
              className="primary-button cta-hero-btn"
              onClick={() => setIsCreateDonationOpen(true)}
            >
              + Publish Food Donation
            </button>
          )}

          {activeRole === 'recipient' && (
            <button
              type="button"
              className="primary-button cta-hero-btn"
              onClick={() => setIsCreateRequirementOpen(true)}
            >
              + Post Food Requirement
            </button>
          )}
        </div>
      </section>

      {/* Dynamic Key Performance Stats Bar */}
      <section className="stats-grid">
        <div className="stat-card">
          <strong>{dashboardStats?.activeDonations ?? 0}</strong>
          <span>Active Food Listings</span>
        </div>
        <div className="stat-card">
          <strong>{dashboardStats?.totalMealsShared ?? 0}</strong>
          <span>Total Meals Shared</span>
        </div>
        <div className="stat-card">
          <strong>{dashboardStats?.openRequests ?? 0}</strong>
          <span>Open Recipient Demands</span>
        </div>
        <div className="stat-card">
          <strong>{dashboardStats?.scheduledRoutes ?? 0}</strong>
          <span>Scheduled Pickups</span>
        </div>
        <div className="stat-card">
          <strong>{dashboardStats?.successRate || '96%'}</strong>
          <span>Pickup Success Rate</span>
        </div>
      </section>

      {/* Sub-Tabs Navigation */}
      <div className="dashboard-subtabs">
        {activeRole === 'donor' && (
          <>
            <button
              className={`subtab-btn ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Active Listings ({myDonations.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              Nearby Recipient Matches ({smartMatches.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'pickups' ? 'active' : ''}`}
              onClick={() => setActiveTab('pickups')}
            >
              Scheduled Pickups ({pickups.filter((p) => p.status === 'scheduled').length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Donation History ({donationHistory.length})
            </button>
          </>
        )}

        {activeRole === 'recipient' && (
          <>
            <button
              className={`subtab-btn ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Available Food & Smart Matches ({allDonations.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'requirements' ? 'active' : ''}`}
              onClick={() => setActiveTab('requirements')}
            >
              My Requirements ({myRequirements.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'pickups' ? 'active' : ''}`}
              onClick={() => setActiveTab('pickups')}
            >
              Scheduled Pickups & Transit ({pickups.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'history' ? 'active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Fulfillment History ({donationHistory.length})
            </button>
          </>
        )}

        {activeRole === 'delivery' && (
          <>
            <button
              className={`subtab-btn ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              Active Routes & Pickups ({pickups.filter((p) => ['scheduled', 'in_transit'].includes(p.status)).length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'completed' ? 'active' : ''}`}
              onClick={() => setActiveTab('completed')}
            >
              Completed Handovers ({pickups.filter((p) => p.status === 'completed').length})
            </button>
          </>
        )}

        {activeRole === 'admin' && (
          <>
            <button
              className={`subtab-btn ${activeTab === 'main' ? 'active' : ''}`}
              onClick={() => setActiveTab('main')}
            >
              All Platform Donations ({allDonations.length || myDonations.length})
            </button>
            <button
              className={`subtab-btn ${activeTab === 'pickups' ? 'active' : ''}`}
              onClick={() => setActiveTab('pickups')}
            >
              Logistics Monitor ({pickups.length})
            </button>
          </>
        )}
      </div>

      {/* ======================================================== */}
      {/* 1. DONOR DASHBOARD VIEWS */}
      {/* ======================================================== */}
      {activeRole === 'donor' && (
        <main className="dashboard-content-area">
          {activeTab === 'main' && (
            <section className="listings-section">
              <div className="section-title-row">
                <div>
                  <h2>My Published Surplus Food</h2>
                  <p>Real-time inventory connected to the automated recipient matching engine.</p>
                </div>
                <button
                  type="button"
                  className="primary-button small-button"
                  onClick={() => setIsCreateDonationOpen(true)}
                >
                  + New Donation
                </button>
              </div>

              {loading ? (
                <div className="empty-state">Loading donations from database...</div>
              ) : myDonations.length === 0 ? (
                <div className="empty-card">
                  <span className="empty-icon">🍲</span>
                  <h3>No active donations published</h3>
                  <p>You have not published any surplus food yet. Create your first donation to begin matching!</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsCreateDonationOpen(true)}
                  >
                    Publish Food Donation
                  </button>
                </div>
              ) : (
                <div className="card-grid">
                  {myDonations.map((item) => (
                    <article key={item.id} className="interactive-card">
                      <div className="card-top-row">
                        <span className={`status-tag status-${item.status}`}>{item.status.replace('_', ' ')}</span>
                        <span className="expiry-indicator">
                          Expires: {new Date(item.expiry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <h3 className="card-food-name">{item.food_name}</h3>
                      <p className="card-meta">
                        {item.food_category} • <strong style={{ textTransform: 'capitalize' }}>{item.food_type}</strong> ({item.preparation_type})
                      </p>

                      <div className="quantity-bar-container">
                        <div className="quantity-text-row">
                          <span>
                            Remaining: <strong>{item.remaining_quantity} {item.quantity_unit}</strong>
                          </span>
                          <span>Initial: {item.quantity} {item.quantity_unit}</span>
                        </div>
                        <div className="progress-track">
                          <div
                            className="progress-fill"
                            style={{
                              width: `${Math.max(5, (item.remaining_quantity / item.quantity) * 100)}%`,
                              background: item.remaining_quantity > 0 ? '#1dbf75' : '#888',
                            }}
                          ></div>
                        </div>
                      </div>

                      <p className="card-description">{item.description || 'No additional notes provided.'}</p>

                      <div className="card-location-meta">
                        <span>📍 {item.pickup_location}</span>
                        <span>📞 {item.contact_phone}</span>
                      </div>

                      <div className="card-button-row">
                        <button
                          type="button"
                          className="secondary-button mini-btn"
                          onClick={() => navigate('/details', { state: { donationId: item.id } })}
                        >
                          View Details & Stepper
                        </button>
                        {['available', 'matched'].includes(item.status) && (
                          <button
                            type="button"
                            className="danger-button mini-btn"
                            onClick={() => handleCancelDonation(item.id)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'matches' && (
            <section className="matches-section">
              <div className="section-title-row">
                <div>
                  <h2>Intelligent Recipient Matches</h2>
                  <p>Organizations whose food requirements match your published surplus.</p>
                </div>
              </div>

              {smartMatches.length === 0 ? (
                <div className="empty-card">
                  <span className="empty-icon">🤝</span>
                  <h3>No matches calculated</h3>
                  <p>The system constantly checks all active donor and recipient records. Matches will populate here automatically.</p>
                </div>
              ) : (
                <div className="card-grid">
                  {smartMatches.map((m, idx) => (
                    <article key={idx} className="interactive-card match-card">
                      <div className="card-top-row">
                        <div className="match-score-badge">
                          <strong>{m.compatibilityScore}%</strong>
                          <span>Match</span>
                        </div>
                        <span className="distance-badge">📍 {m.distanceKm ?? 'Local'} km</span>
                      </div>

                      <h3>{m.requirement.title}</h3>
                      <p className="card-meta">
                        Organization: <strong>{m.requirement.recipient_org || m.requirement.recipient_name}</strong>
                      </p>

                      <div className="match-highlights-box">
                        <p>
                          <strong>Demand:</strong> {m.requirement.required_quantity} {m.requirement.quantity_unit} ({m.requirement.preferred_food_type})
                        </p>
                        <p>
                          <strong>Matched Capacity:</strong> {m.matchedQuantity} {m.requirement.quantity_unit}
                        </p>
                        <p>
                          <strong>Urgency:</strong> <span className={`urgency-tag ${m.requirement.urgency}`}>{m.requirement.urgency}</span>
                        </p>
                      </div>

                      <div className="card-button-row">
                        <button
                          type="button"
                          className="secondary-button mini-btn"
                          onClick={() => handleOpenMatchDetails(m)}
                        >
                          View Criteria Breakdown
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'pickups' && (
            <section className="pickups-section">
              <h2>Scheduled Pickups & Handovers</h2>
              {pickups.length === 0 ? (
                <div className="empty-card">
                  <p>No pickups currently scheduled.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Recipient Organization</th>
                        <th>Reserved Quantity</th>
                        <th>Scheduled Date & Slot</th>
                        <th>Dropoff Destination</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickups.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.food_name}</strong></td>
                          <td>{p.recipient_org} ({p.recipient_name})</td>
                          <td>{p.reserved_quantity} {p.quantity_unit}</td>
                          <td>{p.scheduled_date} • {p.scheduled_time_slot}</td>
                          <td>{p.dropoff_address}</td>
                          <td>
                            <span className={`status-tag status-${p.status}`}>{p.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'history' && (
            <section className="history-section">
              <h2>Completed & Cancelled Donation History</h2>
              {donationHistory.length === 0 ? (
                <div className="empty-card">
                  <p>No historical records yet.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Initial Qty</th>
                        <th>Remaining Qty</th>
                        <th>Final Status</th>
                        <th>Published On</th>
                        <th>Last Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donationHistory.map((h) => (
                        <tr key={h.id}>
                          <td><strong>{h.food_name}</strong></td>
                          <td>{h.quantity} {h.quantity_unit}</td>
                          <td>{h.remaining_quantity} {h.quantity_unit}</td>
                          <td>
                            <span className={`status-tag status-${h.status}`}>{h.status}</span>
                          </td>
                          <td>{new Date(h.created_at).toLocaleDateString()}</td>
                          <td>{new Date(h.updated_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </main>
      )}

      {/* ======================================================== */}
      {/* 2. RECIPIENT DASHBOARD VIEWS */}
      {/* ======================================================== */}
      {activeRole === 'recipient' && (
        <main className="dashboard-content-area">
          {activeTab === 'main' && (
            <section className="recipient-browse-section">
              <div className="section-title-row">
                <div>
                  <h2>Available Food Donations & AI Matches</h2>
                  <p>Fresh surplus food ranked by multi-parameter compatibility scoring.</p>
                </div>
                <button
                  type="button"
                  className="primary-button small-button"
                  onClick={() => setIsCreateRequirementOpen(true)}
                >
                  + Post Requirement
                </button>
              </div>

              {/* Show Smart Matches First if available */}
              {smartMatches.length > 0 && (
                <div className="smart-matches-banner-box">
                  <div className="banner-title">
                    <span>⚡ Recommended High-Compatibility Matches for your Organization:</span>
                  </div>
                  <div className="card-grid">
                    {smartMatches.map((m, idx) => (
                      <article key={idx} className="interactive-card match-card highlight-border">
                        <div className="card-top-row">
                          <div className="match-score-badge">
                            <strong>{m.compatibilityScore}%</strong>
                            <span>Match</span>
                          </div>
                          <span className={`status-tag status-${m.donation.status}`}>{m.donation.status}</span>
                        </div>

                        <h3>{m.donation.food_name}</h3>
                        <p className="card-meta">
                          Donor: <strong>{m.donation.donor_org || m.donation.donor_name}</strong> • 📍 {m.distanceKm ?? '2'} km
                        </p>

                        <div className="match-highlights-box">
                          <p>
                            <strong>Available:</strong> {m.donation.remaining_quantity} {m.donation.quantity_unit}
                          </p>
                          <p>
                            <strong>Expiry Window:</strong> {m.hoursUntilExpiry} hours remaining
                          </p>
                          <p className="reasons-snippet">
                            ✓ {m.reasons?.[0]}
                          </p>
                        </div>

                        <div className="card-button-row">
                          <button
                            type="button"
                            className="secondary-button mini-btn"
                            onClick={() => handleOpenMatchDetails(m)}
                          >
                            Score Breakdown
                          </button>
                          <button
                            type="button"
                            className="primary-button mini-btn"
                            onClick={() => handleOpenAcceptance(m.donation, m, m.requirement)}
                          >
                            Accept Donation
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              )}

              {/* All Available Donations Grid */}
              <div className="all-donations-header">
                <h3>All Live Donations in City</h3>
              </div>

              {allDonations.length === 0 ? (
                <div className="empty-card">
                  <p>No surplus food donations currently available.</p>
                </div>
              ) : (
                <div className="card-grid">
                  {allDonations.map((don) => (
                    <article key={don.id} className="interactive-card">
                      <div className="card-top-row">
                        <span className={`status-tag status-${don.status}`}>{don.status}</span>
                        <span className="expiry-indicator">
                          Expires: {new Date(don.expiry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                        </span>
                      </div>

                      <h3 className="card-food-name">{don.food_name}</h3>
                      <p className="card-meta">
                        {don.food_category} • <strong style={{ textTransform: 'capitalize' }}>{don.food_type}</strong>
                      </p>

                      <div className="quantity-bar-container">
                        <div className="quantity-text-row">
                          <span>Available: <strong>{don.remaining_quantity} {don.quantity_unit}</strong></span>
                        </div>
                      </div>

                      <p className="card-description">{don.description}</p>
                      <div className="card-location-meta">
                        <span>📍 {don.pickup_location}</span>
                        <span>Donor: {don.donor_org}</span>
                      </div>

                      <div className="card-button-row">
                        <button
                          type="button"
                          className="secondary-button mini-btn"
                          onClick={() => navigate('/details', { state: { donationId: don.id } })}
                        >
                          View Details
                        </button>
                        {don.remaining_quantity > 0 && (
                          <button
                            type="button"
                            className="primary-button mini-btn"
                            onClick={() => handleOpenAcceptance(don)}
                          >
                            Accept & Schedule
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'requirements' && (
            <section className="my-requirements-section">
              <div className="section-title-row">
                <div>
                  <h2>Our Organization's Food Demands</h2>
                  <p>Active and past requirements posted for community centers and shelters.</p>
                </div>
                <button
                  type="button"
                  className="primary-button small-button"
                  onClick={() => setIsCreateRequirementOpen(true)}
                >
                  + Post Requirement
                </button>
              </div>

              {myRequirements.length === 0 ? (
                <div className="empty-card">
                  <span className="empty-icon">📋</span>
                  <h3>No requirements submitted</h3>
                  <p>Submit your demand so nearby restaurants and caterers can match their surplus food to you!</p>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsCreateRequirementOpen(true)}
                  >
                    Post Requirement
                  </button>
                </div>
              ) : (
                <div className="card-grid">
                  {myRequirements.map((req) => (
                    <article key={req.id} className="interactive-card">
                      <div className="card-top-row">
                        <span className={`status-tag status-${req.status}`}>{req.status.replace('_', ' ')}</span>
                        <span className={`urgency-tag ${req.urgency}`}>{req.urgency}</span>
                      </div>

                      <h3>{req.title}</h3>
                      <p className="card-meta">
                        {req.food_category} • <strong style={{ textTransform: 'capitalize' }}>{req.preferred_food_type}</strong>
                      </p>

                      <div className="quantity-bar-container">
                        <div className="quantity-text-row">
                          <span>Remaining Needed: <strong>{req.remaining_quantity} {req.quantity_unit}</strong></span>
                          <span>Target: {req.required_quantity}</span>
                        </div>
                      </div>

                      <p className="card-description">{req.additional_notes || req.dietary_restrictions || 'Standard distribution'}</p>

                      <div className="card-location-meta">
                        <span>Needed By: {req.required_by_date} at {req.required_by_time}</span>
                        <span>Dropoff: {req.required_location}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === 'pickups' && (
            <section className="pickups-section">
              <h2>My Confirmed Pickups & Transits</h2>
              {pickups.length === 0 ? (
                <div className="empty-card">
                  <p>No confirmed pickups currently active.</p>
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Food Item</th>
                        <th>Donor Organization</th>
                        <th>Allocated Qty</th>
                        <th>Pickup Date & Slot</th>
                        <th>Pickup Address</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pickups.map((p) => (
                        <tr key={p.id}>
                          <td><strong>{p.food_name}</strong></td>
                          <td>{p.donor_org}</td>
                          <td>{p.reserved_quantity} {p.quantity_unit}</td>
                          <td>{p.scheduled_date} • {p.scheduled_time_slot}</td>
                          <td>{p.pickup_address}</td>
                          <td>
                            <span className={`status-tag status-${p.status}`}>{p.status}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {activeTab === 'history' && (
            <section className="history-section">
              <h2>Recipient Fulfillment History</h2>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Food Item</th>
                      <th>Quantity</th>
                      <th>Donor Organization</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {donationHistory.map((h) => (
                      <tr key={h.id}>
                        <td><strong>{h.food_name}</strong></td>
                        <td>{h.quantity} {h.quantity_unit}</td>
                        <td>{h.donor_org}</td>
                        <td>
                          <span className={`status-tag status-${h.status}`}>{h.status}</span>
                        </td>
                        <td>{new Date(h.updated_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </main>
      )}

      {/* ======================================================== */}
      {/* 3. DELIVERY AGENT VIEW */}
      {/* ======================================================== */}
      {activeRole === 'delivery' && (
        <main className="dashboard-content-area">
          <section className="delivery-section">
            <div className="section-title-row">
              <div>
                <h2>Active Pickup & Logistics Routes</h2>
                <p>Verify cold/hot chain, execute safe handover, and confirm deliveries.</p>
              </div>
            </div>

            {pickups.filter((p) => ['scheduled', 'in_transit'].includes(p.status)).length === 0 ? (
              <div className="empty-card">
                <p>No active routes assigned currently.</p>
              </div>
            ) : (
              <div className="card-grid">
                {pickups
                  .filter((p) => ['scheduled', 'in_transit'].includes(p.status))
                  .map((p) => (
                    <article key={p.id} className="interactive-card route-card">
                      <div className="card-top-row">
                        <span className={`status-tag status-${p.status}`}>{p.status.toUpperCase()}</span>
                        <span className="slot-pill">⏰ {p.scheduled_time_slot}</span>
                      </div>

                      <h3>{p.food_name}</h3>
                      <p className="card-meta">
                        Load: <strong>{p.reserved_quantity} {p.quantity_unit}</strong>
                      </p>

                      <div className="route-flow-box">
                        <div className="route-stop">
                          <span className="stop-marker start">●</span>
                          <div>
                            <strong>Pickup:</strong> {p.donor_org}
                            <p>{p.pickup_address}</p>
                            <small>Contact: {p.donor_contact}</small>
                          </div>
                        </div>

                        <div className="route-stop">
                          <span className="stop-marker end">■</span>
                          <div>
                            <strong>Dropoff:</strong> {p.recipient_org}
                            <p>{p.dropoff_address}</p>
                            <small>Contact: {p.recipient_contact}</small>
                          </div>
                        </div>
                      </div>

                      <div className="card-button-row">
                        {p.status === 'scheduled' && (
                          <button
                            type="button"
                            className="primary-button mini-btn"
                            onClick={() => handleUpdatePickup(p.id, 'in_transit')}
                          >
                            ▶ Start Transit
                          </button>
                        )}
                        {p.status === 'in_transit' && (
                          <button
                            type="button"
                            className="primary-button mini-btn complete-btn"
                            onClick={() => handleUpdatePickup(p.id, 'completed')}
                          >
                            ✓ Confirm Delivery (Complete)
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
              </div>
            )}
          </section>
        </main>
      )}

      {/* ======================================================== */}
      {/* 4. ADMIN VIEW */}
      {/* ======================================================== */}
      {activeRole === 'admin' && (
        <main className="dashboard-content-area">
          <section className="admin-section">
            <div className="section-title-row">
              <div>
                <h2>Operations Board & System Health</h2>
                <p>Platform wide records, audit compliance, and match monitoring.</p>
              </div>
            </div>

            <div className="admin-summary-grid">
              <div className="admin-stat-box">
                <h4>System Status</h4>
                <span className="badge badge-high">HEALTHY & WAL ACTIVE</span>
                <p>Database: SQLite with PRAGMA foreign_keys = ON</p>
              </div>
              <div className="admin-stat-box">
                <h4>Matching Weight Configuration</h4>
                <ul>
                  <li>Food Type: 25%</li>
                  <li>Food Category: 20%</li>
                  <li>Quantity: 20%</li>
                  <li>Proximity: 15%</li>
                  <li>Expiry Buffer: 15%</li>
                  <li>Pickup Window: 5%</li>
                </ul>
              </div>
            </div>

            <h3>All Active Donations Across Zones</h3>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Item</th>
                    <th>Donor</th>
                    <th>Remaining / Total</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(myDonations.length > 0 ? myDonations : allDonations).map((d) => (
                    <tr key={d.id}>
                      <td>#{d.id}</td>
                      <td><strong>{d.food_name}</strong></td>
                      <td>{d.donor_org || d.donor_name}</td>
                      <td>{d.remaining_quantity} / {d.quantity} {d.quantity_unit}</td>
                      <td>{d.food_category}</td>
                      <td><span className={`status-tag status-${d.status}`}>{d.status}</span></td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button mini-btn"
                          onClick={() => navigate('/details', { state: { donationId: d.id } })}
                        >
                          Audit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* Modals */}
      <CreateDonationModal
        isOpen={isCreateDonationOpen}
        onClose={() => setIsCreateDonationOpen(false)}
        onCreated={(newDon) => {
          notifyUser(`Successfully published "${newDon.food_name}"! Matching engine is analyzing nearby demands.`)
          loadDashboardData()
        }}
        currentUser={currentUser}
      />

      <CreateRequirementModal
        isOpen={isCreateRequirementOpen}
        onClose={() => setIsCreateRequirementOpen(false)}
        onCreated={(newReq) => {
          notifyUser(`Requirement "${newReq.title}" posted! Finding matching donors...`)
          loadDashboardData()
        }}
        currentUser={currentUser}
      />

      <AcceptDonationModal
        isOpen={isAcceptModalOpen}
        onClose={() => setIsAcceptModalOpen(false)}
        donation={selectedDonation}
        match={selectedMatch}
        requirement={selectedRequirement}
        currentUser={currentUser}
        onAccepted={(res) => {
          notifyUser(`Donation accepted! Pickup scheduled for ${res.pickupSchedule?.scheduled_date} (${res.pickupSchedule?.scheduled_time_slot}).`)
          loadDashboardData()
        }}
      />

      <MatchDetailsModal
        isOpen={isMatchModalOpen}
        onClose={() => setIsMatchModalOpen(false)}
        match={selectedMatch}
        onAccept={(don, match, req) => handleOpenAcceptance(don, match, req)}
      />

      <NotificationDrawer
        isOpen={isNotifOpen}
        onClose={() => {
          setIsNotifOpen(false)
          loadNotifCount()
        }}
        onNavigate={(path, state) => navigate(path, { state })}
      />
    </div>
  )
}
