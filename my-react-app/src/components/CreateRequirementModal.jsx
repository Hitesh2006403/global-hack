import { useState } from 'react'
import { api } from '../services/api'

export default function CreateRequirementModal({ isOpen, onClose, onCreated, currentUser }) {
  if (!isOpen) return null

  const today = new Date().toISOString().split('T')[0]

  const [formData, setFormData] = useState({
    title: '',
    requiredQuantity: '',
    quantityUnit: 'meals',
    foodCategory: 'Cooked Meals',
    preferredFoodType: 'vegetarian',
    dietaryRestrictions: '',
    requiredByDate: today,
    requiredByTime: '20:30',
    requiredLocation: currentUser?.address ? currentUser.address.split(',')[0] : 'Domlur, Bengaluru',
    address: currentUser?.address || '22, Old Airport Rd, Domlur, Bengaluru',
    latitude: currentUser?.latitude || 12.9610,
    longitude: currentUser?.longitude || 77.6387,
    contactPerson: currentUser?.fullName || 'Sister Riya Joseph',
    contactPhone: currentUser?.phone || '+91 99883 01020',
    additionalNotes: '',
    urgency: 'urgent',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const applyPreset = (type) => {
    if (type === 'shelter') {
      setFormData((prev) => ({
        ...prev,
        title: 'Emergency Dinner for Night Shelter Residents',
        requiredQuantity: '40',
        quantityUnit: 'meals',
        foodCategory: 'Cooked Meals',
        preferredFoodType: 'vegetarian',
        dietaryRestrictions: 'Mild spices, hygienic sealed packaging suitable for elderly residents.',
        requiredByDate: today,
        requiredByTime: '20:30',
        requiredLocation: 'Domlur, Bengaluru',
        address: '22, Old Airport Rd, Domlur, Bengaluru',
        additionalNotes: 'Need nutritious evening meal packs for 40 sheltered individuals.',
        urgency: 'urgent',
      }))
    } else if (type === 'kitchen') {
      setFormData((prev) => ({
        ...prev,
        title: 'Fresh Bread, Buns & Fruit Supplementary Food',
        requiredQuantity: '25',
        quantityUnit: 'boxes',
        foodCategory: 'Bakery & Snacks',
        preferredFoodType: 'vegan',
        dietaryRestrictions: '100% plant based snack boxes.',
        requiredByDate: today,
        requiredByTime: '21:00',
        requiredLocation: 'Whitefield, Bengaluru',
        address: '15, ITPL Main Rd, Whitefield, Bengaluru',
        additionalNotes: 'Evening supplementary food drive for community center.',
        urgency: 'normal',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const qty = parseFloat(formData.requiredQuantity)
    if (isNaN(qty) || qty <= 0) {
      return setError('Required food quantity must be greater than zero.')
    }

    setLoading(true)
    try {
      const res = await api.createRequirement(formData)
      setLoading(false)
      onCreated(res.requirement)
      onClose()
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Failed to submit requirement.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Recipient Portal</span>
            <h2>Submit Food Requirement</h2>
            <p>Post your organization's food demand so the intelligent matching engine can find suitable donors.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Demo Fast Presets */}
        <div className="preset-bar">
          <span className="preset-label">⚡ Demo Presets:</span>
          <button type="button" className="preset-chip" onClick={() => applyPreset('shelter')}>
            Night Shelter Dinner (40 meals by 8:30 PM)
          </button>
          <button type="button" className="preset-chip" onClick={() => applyPreset('kitchen')}>
            Community Snacks (25 boxes)
          </button>
        </div>

        {error && <div className="modal-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="donation-form-grid">
          <div className="form-section-title">1. Requirement Overview</div>

          <div className="form-group full-width">
            <label>Requirement Title / Purpose *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Need 40 vegetarian meals for night shelter by 8 PM"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Required Quantity *</label>
            <input
              type="number"
              name="requiredQuantity"
              min="1"
              step="any"
              value={formData.requiredQuantity}
              onChange={handleChange}
              placeholder="e.g. 40"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Quantity Unit *</label>
            <select name="quantityUnit" value={formData.quantityUnit} onChange={handleChange} required>
              <option value="meals">Meals / Portions</option>
              <option value="packets">Packets</option>
              <option value="kilograms">Kilograms (kg)</option>
              <option value="boxes">Boxes</option>
              <option value="trays">Trays</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Food Category *</label>
            <select name="foodCategory" value={formData.foodCategory} onChange={handleChange} required>
              <option value="Cooked Meals">Cooked Meals</option>
              <option value="Bakery & Snacks">Bakery & Snacks</option>
              <option value="Fresh Produce">Fresh Produce</option>
              <option value="Packaged Groceries">Packaged Groceries</option>
              <option value="Dairy & Beverages">Dairy & Beverages</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Preferred Dietary Type *</label>
            <select name="preferredFoodType" value={formData.preferredFoodType} onChange={handleChange} required>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan (Strict Plant-Based)</option>
              <option value="non-vegetarian">Non-Vegetarian</option>
              <option value="any">Any Compatible Food</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Urgency Level *</label>
            <select name="urgency" value={formData.urgency} onChange={handleChange} required>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent Priority</option>
              <option value="emergency">Critical Emergency</option>
            </select>
          </div>

          <div className="form-section-title">2. Distribution Schedule & Location</div>

          <div className="form-group half-width">
            <label>Needed By Date *</label>
            <input
              type="date"
              name="requiredByDate"
              value={formData.requiredByDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Needed By Time *</label>
            <input
              type="time"
              name="requiredByTime"
              value={formData.requiredByTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Target Area / Locality *</label>
            <input
              type="text"
              name="requiredLocation"
              value={formData.requiredLocation}
              onChange={handleChange}
              placeholder="e.g. Domlur, Bengaluru"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Delivery / Dropoff Address *</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="e.g. 22, Old Airport Rd, Domlur"
              required
            />
          </div>

          <div className="form-section-title">3. Contact & Dietary Specifications</div>

          <div className="form-group half-width">
            <label>Contact Person *</label>
            <input
              type="text"
              name="contactPerson"
              value={formData.contactPerson}
              onChange={handleChange}
              placeholder="Coordinator name"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Contact Phone Number *</label>
            <input
              type="tel"
              name="contactPhone"
              value={formData.contactPhone}
              onChange={handleChange}
              placeholder="+91 99883 01020"
              required
            />
          </div>

          <div className="form-group full-width">
            <label>Dietary Restrictions & Special Requirements</label>
            <input
              type="text"
              name="dietaryRestrictions"
              value={formData.dietaryRestrictions}
              onChange={handleChange}
              placeholder="e.g. No beef/pork, low spice for senior citizens, peanut allergy..."
            />
          </div>

          <div className="form-group full-width">
            <label>Additional Notes</label>
            <textarea
              name="additionalNotes"
              rows="2"
              value={formData.additionalNotes}
              onChange={handleChange}
              placeholder="Information on beneficiaries, storage facilities, or collection availability..."
            />
          </div>

          <div className="modal-actions full-width">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Submitting to Database...' : 'Submit Food Requirement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
