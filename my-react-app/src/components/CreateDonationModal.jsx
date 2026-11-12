import { useState } from 'react'
import { api } from '../services/api'

export default function CreateDonationModal({ isOpen, onClose, onCreated, currentUser }) {
  if (!isOpen) return null

  const now = new Date()
  const defaultPrep = new Date(now.getTime() - 60 * 60 * 1000).toISOString().slice(0, 16)
  const defaultExpiry = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16)
  const defaultWinStart = new Date(now.getTime() + 30 * 60 * 1000).toISOString().slice(0, 16)
  const defaultWinEnd = new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString().slice(0, 16)

  const [formData, setFormData] = useState({
    foodName: '',
    quantity: '',
    quantityUnit: 'meals',
    foodCategory: 'Cooked Meals',
    foodType: 'vegetarian',
    preparationType: 'cooked',
    prepTime: defaultPrep,
    expiryTime: defaultExpiry,
    pickupLocation: currentUser?.address ? currentUser.address.split(',')[0] : 'Koramangala 4th Block',
    pickupAddress: currentUser?.address || '14, 5th Cross, Koramangala 4th Block, Bengaluru',
    latitude: currentUser?.latitude || 12.9352,
    longitude: currentUser?.longitude || 77.6245,
    description: '',
    imageUrl: '',
    pickupWindowStart: defaultWinStart,
    pickupWindowEnd: defaultWinEnd,
    specialInstructions: 'Insulated hot containers provided. Loading dock accessible.',
    contactName: currentUser?.fullName || '',
    contactPhone: currentUser?.phone || '+91 98989 11222',
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  // Quick Demo Presets
  const applyPreset = (type) => {
    if (type === 'biryani') {
      setFormData((prev) => ({
        ...prev,
        foodName: 'Fresh Royal Dum Biryani with Raita & Salan',
        quantity: '50',
        quantityUnit: 'meals',
        foodCategory: 'Cooked Meals',
        foodType: 'vegetarian',
        preparationType: 'cooked',
        description: 'Nutritious layered vegetable biryani packed in microwave-safe hygienic containers.',
        specialInstructions: 'Keep warm above 60°C. Dispense within 6 hours.',
        pickupLocation: 'Koramangala 4th Block',
        pickupAddress: '14, 5th Cross, Koramangala 4th Block, Bengaluru',
      }))
    } else if (type === 'snacks') {
      setFormData((prev) => ({
        ...prev,
        foodName: 'Wholewheat Sandwiches & Fresh Fruit Boxes',
        quantity: '30',
        quantityUnit: 'boxes',
        foodCategory: 'Bakery & Snacks',
        foodType: 'vegan',
        preparationType: 'packaged',
        description: 'Individually wrapped cucumber-tomato wholewheat sandwiches and sliced apples.',
        specialInstructions: 'Store in chilled conditions. Ready for direct distribution.',
        pickupLocation: 'Indiranagar 100 Feet Rd',
        pickupAddress: '88, 100 Feet Rd, Indiranagar, Bengaluru',
      }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    const qty = parseFloat(formData.quantity)
    if (isNaN(qty) || qty <= 0) {
      return setError('Food quantity must be a positive number greater than 0.')
    }

    if (new Date(formData.expiryTime) <= new Date()) {
      return setError('Expiry time must be in the future. Expired food cannot be listed.')
    }

    if (new Date(formData.expiryTime) <= new Date(formData.prepTime)) {
      return setError('Expiry time must be later than preparation time.')
    }

    setLoading(true)
    try {
      const res = await api.createDonation(formData)
      setLoading(false)
      onCreated(res.donation)
      onClose()
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Failed to publish donation.')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content large-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">Donor Portal</span>
            <h2>Publish Food Donation</h2>
            <p>List surplus food for automated intelligent matching with nearby recipient organizations.</p>
          </div>
          <button type="button" className="modal-close-button" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Demo Fast Presets */}
        <div className="preset-bar">
          <span className="preset-label">⚡ Demo Presets:</span>
          <button type="button" className="preset-chip" onClick={() => applyPreset('biryani')}>
            Biryani Meals (50 portions)
          </button>
          <button type="button" className="preset-chip" onClick={() => applyPreset('snacks')}>
            Fruit & Snacks (30 boxes)
          </button>
        </div>

        {error && <div className="modal-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="donation-form-grid">
          {/* Section 1: Food Details */}
          <div className="form-section-title">1. Food Information</div>

          <div className="form-group full-width">
            <label>Food Item Name *</label>
            <input
              type="text"
              name="foodName"
              value={formData.foodName}
              onChange={handleChange}
              placeholder="e.g. Fresh Vegetable Biryani with Raita"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Quantity *</label>
            <input
              type="number"
              name="quantity"
              min="1"
              step="any"
              value={formData.quantity}
              onChange={handleChange}
              placeholder="e.g. 50"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Unit of Measure *</label>
            <select name="quantityUnit" value={formData.quantityUnit} onChange={handleChange} required>
              <option value="meals">Meals / Portions</option>
              <option value="packets">Packets</option>
              <option value="kilograms">Kilograms (kg)</option>
              <option value="boxes">Boxes</option>
              <option value="trays">Trays</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Category *</label>
            <select name="foodCategory" value={formData.foodCategory} onChange={handleChange} required>
              <option value="Cooked Meals">Cooked Meals</option>
              <option value="Bakery & Snacks">Bakery & Snacks</option>
              <option value="Fresh Produce">Fresh Produce</option>
              <option value="Packaged Groceries">Packaged Groceries</option>
              <option value="Dairy & Beverages">Dairy & Beverages</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Dietary Type *</label>
            <select name="foodType" value={formData.foodType} onChange={handleChange} required>
              <option value="vegetarian">Vegetarian</option>
              <option value="vegan">Vegan (100% Plant-Based)</option>
              <option value="non-vegetarian">Non-Vegetarian</option>
            </select>
          </div>

          <div className="form-group third-width">
            <label>Preparation Type *</label>
            <select name="preparationType" value={formData.preparationType} onChange={handleChange} required>
              <option value="cooked">Cooked</option>
              <option value="packaged">Packaged</option>
              <option value="fresh produce">Fresh Produce</option>
              <option value="raw ingredients">Raw Ingredients</option>
            </select>
          </div>

          {/* Section 2: Timeline & Safety */}
          <div className="form-section-title">2. Preparation & Expiry Timeline</div>

          <div className="form-group half-width">
            <label>Preparation Date & Time</label>
            <input
              type="datetime-local"
              name="prepTime"
              value={formData.prepTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Safe-Consumption Expiry Deadline *</label>
            <input
              type="datetime-local"
              name="expiryTime"
              value={formData.expiryTime}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Pickup Window Start</label>
            <input
              type="datetime-local"
              name="pickupWindowStart"
              value={formData.pickupWindowStart}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Pickup Window End</label>
            <input
              type="datetime-local"
              name="pickupWindowEnd"
              value={formData.pickupWindowEnd}
              onChange={handleChange}
              required
            />
          </div>

          {/* Section 3: Location & Coordinates */}
          <div className="form-section-title">3. Pickup Location & Logistics</div>

          <div className="form-group half-width">
            <label>Pickup Area / Locality *</label>
            <input
              type="text"
              name="pickupLocation"
              value={formData.pickupLocation}
              onChange={handleChange}
              placeholder="e.g. Koramangala, Bengaluru"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Full Pickup Address *</label>
            <input
              type="text"
              name="pickupAddress"
              value={formData.pickupAddress}
              onChange={handleChange}
              placeholder="Building, Street, Landmark"
              required
            />
          </div>

          <div className="form-group half-width">
            <label>Latitude (Coordinates)</label>
            <input
              type="number"
              step="any"
              name="latitude"
              value={formData.latitude}
              onChange={handleChange}
              placeholder="12.9352"
            />
          </div>

          <div className="form-group half-width">
            <label>Longitude (Coordinates)</label>
            <input
              type="number"
              step="any"
              name="longitude"
              value={formData.longitude}
              onChange={handleChange}
              placeholder="77.6245"
            />
          </div>

          {/* Section 4: Contact & Instructions */}
          <div className="form-section-title">4. Contact & Handling Instructions</div>

          <div className="form-group half-width">
            <label>Contact Person Name *</label>
            <input
              type="text"
              name="contactName"
              value={formData.contactName}
              onChange={handleChange}
              placeholder="Name of manager or chef"
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
              placeholder="+91 98989 11222"
              required
            />
          </div>

          <div className="form-group full-width">
            <label>Food Description & Hygiene Notes</label>
            <textarea
              name="description"
              rows="2"
              value={formData.description}
              onChange={handleChange}
              placeholder="Details on preparation, packaging, allergens, and ingredients..."
            />
          </div>

          <div className="form-group full-width">
            <label>Special Handling Instructions</label>
            <input
              type="text"
              name="specialInstructions"
              value={formData.specialInstructions}
              onChange={handleChange}
              placeholder="e.g. Keep insulated, loading dock at rear entrance..."
            />
          </div>

          <div className="modal-actions full-width">
            <button type="button" className="secondary-button" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? 'Publishing to Database...' : 'Publish Food Donation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
