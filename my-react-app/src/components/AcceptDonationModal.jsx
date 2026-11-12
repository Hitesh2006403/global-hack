import { useState, useEffect } from 'react'
import { api } from '../services/api'

export default function AcceptDonationModal({ isOpen, onClose, onAccepted, donation, match, requirement, currentUser }) {
  if (!isOpen || !donation) return null

  const maxAvailable = donation.remaining_quantity
  const defaultNeed = requirement ? Math.min(requirement.remaining_quantity, maxAvailable) : maxAvailable
  const today = new Date().toISOString().split('T')[0]

  const [requestedQuantity, setRequestedQuantity] = useState(defaultNeed)
  const [scheduledDate, setScheduledDate] = useState(today)
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState('19:00 - 20:00')
  const [dropoffAddress, setDropoffAddress] = useState(currentUser?.address || 'Community Center / Shelter')
  const [recipientContact, setRecipientContact] = useState(`${currentUser?.fullName || ''} • ${currentUser?.phone || ''}`)
  const [pickupInstructions, setPickupInstructions] = useState('Standard food-grade thermal containers. Check seal integrity upon pickup.')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRequestedQuantity(defaultNeed)
  }, [defaultNeed])

  const remainingAfterAccept = Math.max(0, maxAvailable - (parseFloat(requestedQuantity) || 0))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const qty = parseFloat(requestedQuantity)
    if (isNaN(qty) || qty <= 0) {
      return setError('Accepted quantity must be greater than zero.')
    }

    if (qty > maxAvailable) {
      return setError(`Cannot accept ${qty} ${donation.quantity_unit}. Only ${maxAvailable} is available!`)
    }

    setLoading(true)
    try {
      const payload = {
        requirementId: requirement?.id || null,
        requestedQuantity: qty,
        scheduledDate,
        scheduledTimeSlot,
        dropoffAddress,
        recipientContact,
        pickupInstructions,
      }
      const res = await api.acceptDonation(donation.id, payload)
      setLoading(false)
      onAccepted(res)
      onClose()
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Failed to accept donation.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content medium-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Acceptance & Logistics</span>
            <h2>Accept Food Donation</h2>
            <p>Coordinate pickup and reserve allocation before the safe consumption deadline.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Donation Brief Card */}
        <div className="acceptance-summary-card">
          <div className="summary-row">
            <div>
              <h3>{donation.food_name}</h3>
              <p className="summary-meta">
                Donor: <strong>{donation.donor_org || donation.donor_name}</strong> • Locality: {donation.pickup_location}
              </p>
            </div>
            {match && (
              <div className="match-pill-large">
                <strong>{match.compatibilityScore}%</strong>
                <span>Match</span>
              </div>
            )}
          </div>

          <div className="summary-stats-bar">
            <div>
              <span>Available Qty:</span>
              <strong>{maxAvailable} {donation.quantity_unit}</strong>
            </div>
            <div>
              <span>Safe Expiry:</span>
              <strong>{new Date(donation.expiry_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}</strong>
            </div>
            <div>
              <span>Food Type:</span>
              <strong style={{ textTransform: 'capitalize' }}>{donation.food_type} ({donation.preparation_type})</strong>
            </div>
          </div>
        </div>

        {error && <div className="modal-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="acceptance-form">
          {/* Quantity Section with Scenario Handling */}
          <div className="form-group full-width">
            <label>Quantity to Accept ({donation.quantity_unit}) *</label>
            <div className="qty-input-wrapper">
              <input
                type="number"
                min="1"
                max={maxAvailable}
                step="any"
                value={requestedQuantity}
                onChange={(e) => setRequestedQuantity(e.target.value)}
                required
              />
              <button
                type="button"
                className="secondary-button mini-btn"
                onClick={() => setRequestedQuantity(maxAvailable)}
              >
                Accept All ({maxAvailable})
              </button>
            </div>
            <span className="field-hint">
              {remainingAfterAccept > 0 ? (
                <span className="text-accent">
                  ⚡ Partial claim: <strong>{remainingAfterAccept} {donation.quantity_unit}</strong> will remain available for other community kitchens.
                </span>
              ) : (
                <span className="text-success">
                  ✓ Full allocation: All {maxAvailable} {donation.quantity_unit} will be reserved for your organization.
                </span>
              )}
            </span>
          </div>

          <div className="form-group half-width">
            <label>Pickup Date *</label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Pickup Time Slot *</label>
            <select
              value={scheduledTimeSlot}
              onChange={(e) => setScheduledTimeSlot(e.target.value)}
              required
            >
              <option value="18:00 - 19:00">Today, 6:00 PM - 7:00 PM</option>
              <option value="19:00 - 20:00">Today, 7:00 PM - 8:00 PM</option>
              <option value="20:00 - 21:00">Today, 8:00 PM - 9:00 PM</option>
              <option value="21:00 - 22:00">Today, 9:00 PM - 10:00 PM</option>
              <option value="08:00 - 09:30">Tomorrow, 8:00 AM - 9:30 AM</option>
              <option value="10:00 - 11:30">Tomorrow, 10:00 AM - 11:30 AM</option>
            </select>
          </div>

          <div className="form-group full-width">
            <label>Dropoff / Destination Facility Address *</label>
            <input
              type="text"
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="Full shelter or distribution center address"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Recipient Contact Person & Phone *</label>
            <input
              type="text"
              value={recipientContact}
              onChange={(e) => setRecipientContact(e.target.value)}
              placeholder="Sister Riya • +91 99883 01020"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Pickup Address (from Donor)</label>
            <input
              type="text"
              value={donation.pickup_address}
              disabled
              style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-group full-width">
            <label>Handling & Logistics Instructions</label>
            <input
              type="text"
              value={pickupInstructions}
              onChange={(e) => setPickupInstructions(e.target.value)}
              placeholder="Vehicle requirements, thermal box notes, coordinator instructions..."
            />
          </div>

          <div className="modal-actions full-width">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Processing Transaction...' : `Confirm & Schedule Pickup (${requestedQuantity} ${donation.quantity_unit})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
