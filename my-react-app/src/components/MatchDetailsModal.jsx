export default function MatchDetailsModal({ isOpen, onClose, match, onAccept }) {
  if (!isOpen || !match) return null

  const {
    donation,
    requirement,
    compatibilityScore,
    matchedQuantity,
    remainingDonationQuantity,
    remainingRequirementQuantity,
    isFullMatch,
    isPartialMatch,
    distanceKm,
    hoursUntilExpiry,
    breakdown,
    reasons,
    warnings,
  } = match

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content medium-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Intelligent Matching Engine</span>
            <h2>Match Compatibility Breakdown</h2>
            <p>Calculated using 6 multi-parameter weighted scoring algorithms with strict safety eligibility filtering.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Big Score Header */}
        <div className="match-score-banner">
          <div className="score-circle">
            <span className="score-number">{compatibilityScore}%</span>
            <span className="score-label">Overall Match</span>
          </div>
          <div className="score-text-summary">
            <h3>{donation.food_name}</h3>
            <p>
              Matched with requirement: <strong>"{requirement.title}"</strong>
            </p>
            <div className="match-type-pill-row">
              {isFullMatch && <span className="pill pill-success">✓ 100% Demand Satisfaction</span>}
              {isPartialMatch && (
                <span className="pill pill-warning">
                  ⚡ Partial Fulfillment ({matchedQuantity} of {requirement.required_quantity} {requirement.quantity_unit})
                </span>
              )}
              {distanceKm != null && <span className="pill pill-info">📍 {distanceKm} km away</span>}
              <span className="pill pill-neutral">⏱ {hoursUntilExpiry}h safe buffer</span>
            </div>
          </div>
        </div>

        {/* 6 Parameter Breakdown Bars */}
        <div className="breakdown-section">
          <h4>Configured Weighted Criteria Scoring</h4>

          <div className="breakdown-grid">
            <div className="breakdown-item">
              <div className="item-label">
                <span>Food Type Compatibility (25%)</span>
                <strong>{breakdown?.foodType || 0} / 25 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.foodType || 0) / 25) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-label">
                <span>Food Category Match (20%)</span>
                <strong>{breakdown?.foodCategory || 0} / 20 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.foodCategory || 0) / 20) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-label">
                <span>Quantity Compatibility (20%)</span>
                <strong>{breakdown?.quantity || 0} / 20 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.quantity || 0) / 20) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-label">
                <span>Geographic Proximity (15%)</span>
                <strong>{breakdown?.proximity || 0} / 15 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.proximity || 0) / 15) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-label">
                <span>Expiry & Deadline Buffer (15%)</span>
                <strong>{breakdown?.expiryBuffer || 0} / 15 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.expiryBuffer || 0) / 15) * 100}%` }}
                ></div>
              </div>
            </div>

            <div className="breakdown-item">
              <div className="item-label">
                <span>Pickup Window Alignment (5%)</span>
                <strong>{breakdown?.pickupWindow || 0} / 5 pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${((breakdown?.pickupWindow || 0) / 5) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Reasons & Warnings */}
        <div className="reasons-section">
          {reasons && reasons.length > 0 && (
            <div className="reasons-block">
              <h5>✓ Validated Compatibility Factors:</h5>
              <ul>
                {reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          )}

          {warnings && warnings.length > 0 && (
            <div className="warnings-block">
              <h5>⚠ Advisory Notices:</h5>
              <ul>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
          {onAccept && (
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                onClose()
                onAccept(donation, match, requirement)
              }}
            >
              Proceed to Accept Donation
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
