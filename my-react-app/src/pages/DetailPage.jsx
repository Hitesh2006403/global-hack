import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import logoImage from '../assets/logo image.png'
import { api } from '../services/api'
import AcceptDonationModal from '../components/AcceptDonationModal'

const LIFECYCLE_STAGES = [
  { key: 'available', label: '1. Available' },
  { key: 'matched', label: '2. Matched' },
  { key: 'accepted', label: '3. Accepted' },
  { key: 'scheduled', label: '4. Scheduled' },
  { key: 'in_transit', label: '5. In Transit' },
  { key: 'completed', label: '6. Completed' },
]

function getStageIndex(status) {
  if (status === 'available') return 0
  if (status === 'matched') return 1
  if (status === 'partially_accepted' || status === 'accepted') return 2
  if (status === 'scheduled') return 3
  if (status === 'in_transit') return 4
  if (status === 'completed') return 5
  return -1 // cancelled or expired
}

export default function DetailPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const donationId =
    searchParams.get('id') || location.state?.donationId || location.state?.card?.id || 1

  const currentUser = api.getCurrentUser()

  const [donation, setDonation] = useState(null)
  const [statusHistory, setStatusHistory] = useState([])
  const [reservations, setReservations] = useState([])
  const [pickupSchedules, setPickupSchedules] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isAcceptOpen, setIsAcceptOpen] = useState(false)
  const [actionNotice, setActionNotice] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api.getDonation(donationId)
      setDonation(res.donation)
      setStatusHistory(res.statusHistory || [])
      setReservations(res.reservations || [])
      setPickupSchedules(res.pickupSchedules || [])
      setLoading(false)
    } catch (err) {
      setError(err.message || 'Failed to retrieve donation details.')
      setLoading(false)
    }
  }, [donationId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this donation?')) return
    try {
      await api.cancelDonation(donationId)
      setActionNotice('Donation cancelled.')
      loadData()
    } catch (err) {
      alert(err.message)
    }
  }

  const currentStageIdx = donation ? getStageIndex(donation.status) : 0
  const isTerminal = ['cancelled', 'expired'].includes(donation?.status)

  // Calculate live time remaining
  let expiryText = ''
  if (donation?.expiry_time) {
    const diffMs = new Date(donation.expiry_time).getTime() - Date.now()
    if (diffMs <= 0) {
      expiryText = 'EXPIRED'
    } else {
      const hrs = Math.floor(diffMs / (1000 * 60 * 60))
      const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
      expiryText = `${hrs}h ${mins}m remaining`
    }
  }

  return (
    <div className="app-shell">
      {/* Top Header */}
      <header className="topbar dashboard-topbar">
        <div className="brand-wrap">
          <div className="brand-mark dashboard-avatar-small" aria-label="Share A Plate logo">
            <img src={logoImage} alt="Share A Plate logo" className="brand-logo-image" />
          </div>
          <div className="brand-text">
            <span className="brand-name">
              <span className="brand-name-main">Share</span> <span className="brand-name-accent">A Plate</span>
            </span>
            <span className="brand-tag">Food Traceability & Audit Details</span>
          </div>
        </div>

        <div className="topbar-right-actions">
          <button
            type="button"
            className="secondary-button small-button"
            onClick={() => navigate('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </header>

      {actionNotice && <div className="global-toast-banner">✓ {actionNotice}</div>}

      <main className="detail-page-container">
        {loading ? (
          <div className="empty-state">Loading donation record #{donationId}...</div>
        ) : error || !donation ? (
          <div className="empty-card">
            <span className="empty-icon">⚠</span>
            <h3>Record Not Found</h3>
            <p>{error || 'Donation record does not exist or has been removed.'}</p>
            <button type="button" className="primary-button" onClick={() => navigate('/dashboard')}>
              Return to Dashboard
            </button>
          </div>
        ) : (
          <>
            {/* Header Title & Status */}
            <div className="detail-header-card">
              <div className="detail-header-main">
                <div className="tag-row">
                  <span className={`status-tag status-${donation.status}`}>
                    {donation.status.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="food-type-tag" style={{ textTransform: 'capitalize' }}>
                    {donation.food_type} ({donation.preparation_type})
                  </span>
                  <span className="category-pill">{donation.food_category}</span>
                </div>

                <h1>{donation.food_name}</h1>
                <p className="detail-subhead">
                  Published by <strong>{donation.donor_org || donation.donor_name}</strong> • Reference Listing #{donation.id}
                </p>
              </div>

              <div className="detail-header-actions">
                {donation.remaining_quantity > 0 && !isTerminal && (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => setIsAcceptOpen(true)}
                  >
                    Accept & Schedule Pickup
                  </button>
                )}

                {['available', 'matched'].includes(donation.status) && (
                  <button type="button" className="danger-button" onClick={handleCancel}>
                    Cancel Listing
                  </button>
                )}
              </div>
            </div>

            {/* Lifecycle Stepper Bar */}
            <div className="stepper-card">
              <h3>Real-Time Donation Lifecycle Tracker</h3>
              {isTerminal ? (
                <div className="terminal-alert">
                  ⚠ This donation ended in terminal status: <strong>{donation.status.toUpperCase()}</strong>.
                </div>
              ) : (
                <div className="stepper-flow">
                  {LIFECYCLE_STAGES.map((stg, i) => {
                    const isDone = i <= currentStageIdx
                    const isCurrent = i === currentStageIdx
                    return (
                      <div
                        key={stg.key}
                        className={`step-item ${isDone ? 'completed' : ''} ${isCurrent ? 'active' : ''}`}
                      >
                        <div className="step-circle">{isDone ? '✓' : i + 1}</div>
                        <span className="step-label">{stg.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Main Details Grid */}
            <div className="detail-two-col-layout">
              {/* Left Column: Food & Quantity */}
              <div className="detail-card-panel">
                <h3>Food & Inventory Specifications</h3>

                <div className="detail-spec-grid">
                  <div className="spec-item">
                    <span>Total Quantity</span>
                    <strong>{donation.quantity} {donation.quantity_unit}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Remaining Available</span>
                    <strong className="text-accent">{donation.remaining_quantity} {donation.quantity_unit}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Safe Expiry Deadline</span>
                    <strong>{new Date(donation.expiry_time).toLocaleString()}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Freshness Status</span>
                    <strong className={expiryText === 'EXPIRED' ? 'text-danger' : 'text-success'}>
                      ⏱ {expiryText}
                    </strong>
                  </div>

                  <div className="spec-item">
                    <span>Preparation Time</span>
                    <strong>{new Date(donation.prep_time).toLocaleString()}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Pickup Window</span>
                    <strong>
                      {new Date(donation.pickup_window_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                      {new Date(donation.pickup_window_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </strong>
                  </div>
                </div>

                <div className="detail-text-block">
                  <h4>Food Description & Preparation Notes</h4>
                  <p>{donation.description || 'No specific description recorded.'}</p>
                </div>

                <div className="detail-text-block">
                  <h4>Special Handling & Cold Chain Instructions</h4>
                  <p>{donation.special_instructions || 'Standard safe hygiene procedures apply.'}</p>
                </div>
              </div>

              {/* Right Column: Location & Contact */}
              <div className="detail-card-panel">
                <h3>Pickup Location & Contact</h3>

                <div className="detail-spec-grid">
                  <div className="spec-item full">
                    <span>Pickup Locality</span>
                    <strong>{donation.pickup_location}</strong>
                  </div>

                  <div className="spec-item full">
                    <span>Complete Street Address</span>
                    <strong>{donation.pickup_address}</strong>
                  </div>

                  <div className="spec-item">
                    <span>GPS Latitude</span>
                    <strong>{donation.latitude ?? '12.9352'}</strong>
                  </div>

                  <div className="spec-item">
                    <span>GPS Longitude</span>
                    <strong>{donation.longitude ?? '77.6245'}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Contact Person</span>
                    <strong>{donation.contact_name}</strong>
                  </div>

                  <div className="spec-item">
                    <span>Telephone / Mobile</span>
                    <strong>{donation.contact_phone}</strong>
                  </div>
                </div>

                {/* Scheduled Pickups for this Donation */}
                <h4 style={{ marginTop: '24px' }}>Active Pickups & Allocations</h4>
                {pickupSchedules.length === 0 ? (
                  <p className="subtext">No pickups scheduled yet for this donation.</p>
                ) : (
                  <div className="mini-pickup-list">
                    {pickupSchedules.map((p) => (
                      <div key={p.id} className="mini-pickup-card">
                        <div>
                          <strong>{p.scheduled_date} • {p.scheduled_time_slot}</strong>
                          <p>Dropoff: {p.dropoff_address}</p>
                        </div>
                        <span className={`status-tag status-${p.status}`}>{p.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Status History & Audit Trail */}
            <div className="detail-card-panel full-width" style={{ marginTop: '24px' }}>
              <h3>Lifecycle Audit Trail & Status History</h3>
              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Previous Status</th>
                      <th>New Status</th>
                      <th>Changed By</th>
                      <th>Audit Event Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusHistory.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.timestamp).toLocaleString()}</td>
                        <td>{h.previous_status || 'Initial Creation'}</td>
                        <td>
                          <span className={`status-tag status-${h.new_status}`}>{h.new_status}</span>
                        </td>
                        <td>{h.changed_by_name || 'System Auto'} ({h.changed_by_role || 'Daemon'})</td>
                        <td>{h.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Acceptance Modal */}
      {donation && (
        <AcceptDonationModal
          isOpen={isAcceptOpen}
          onClose={() => setIsAcceptOpen(false)}
          donation={donation}
          currentUser={currentUser}
          onAccepted={() => {
            setActionNotice('Donation accepted and pickup scheduled!')
            loadData()
          }}
        />
      )}
    </div>
  )
}
