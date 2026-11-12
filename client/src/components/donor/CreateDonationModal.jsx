import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { Utensils, Clock, ShieldCheck, MapPin, Image as ImageIcon, Flame } from 'lucide-react';

const SAMPLE_IMAGES = [
  { label: 'Hot Meals', url: 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bakery', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'Fresh Produce', url: 'https://images.unsplash.com/photo-1619566636858-adf3ef46400b?auto=format&fit=crop&w=600&q=80' },
  { label: 'Rice & Curry', url: 'https://images.unsplash.com/photo-1610057099443-fde8c4d50f91?auto=format&fit=crop&w=600&q=80' },
];

export const CreateDonationModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { createDonation } = useDonations();

  const [formData, setFormData] = useState({
    foodName: '',
    venueType: 'HOTELS',
    foodType: 'cooked_meals',
    initialQuantity: 50,
    unit: 'servings',
    dietaryCategory: 'veg',
    storageCondition: 'heated',
    hoursUntilExpiry: 3,
    safetyBufferMinutes: 45,
    pickupAddress: currentUser?.address || 'MG Road, Bengaluru',
    pickupLandmark: 'Loading Bay Gate 2',
    pickupAvailability: 'Immediate pickup preferred',
    imageUrl: SAMPLE_IMAGES[0].url,
    declarations: {
      hygieneChecked: true,
      temperatureSafe: true,
      sealedPacks: true,
    },
    allergenNotes: '',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.foodName.trim()) return;

    try {
      setSubmitting(true);
      const now = new Date();
      const cookedTime = new Date(now.getTime() - 45 * 60 * 1000).toISOString(); // 45m ago
      const expiryDeadline = new Date(now.getTime() + formData.hoursUntilExpiry * 60 * 60 * 1000).toISOString();

      await createDonation({
        donorId: currentUser?.id || 'donor-1',
        donorName: currentUser?.organizationName || currentUser?.name || 'Grand Hyatt Bistro',
        venueType: formData.venueType,
        donorPhone: currentUser?.phone || '+91 98765 43210',
        foodName: formData.foodName,
        foodType: formData.foodType,
        initialQuantity: Number(formData.initialQuantity),
        remainingQuantity: Number(formData.initialQuantity),
        unit: formData.unit,
        dietaryCategory: formData.dietaryCategory,
        storageCondition: formData.storageCondition,
        cookedTime,
        expiryDeadline,
        safetyBufferMinutes: Number(formData.safetyBufferMinutes),
        imageUrl: formData.imageUrl,
        pickupLocation: {
          address: formData.pickupAddress,
          landmark: formData.pickupLandmark,
          coordinates: [77.62, 12.97],
        },
        pickupAvailability: formData.pickupAvailability,
        foodSafetyDeclaration: {
          hygienicallyPrepared: formData.declarations.hygieneChecked,
          temperatureMaintained: formData.declarations.temperatureSafe,
          sealedPackaging: formData.declarations.sealedPacks,
          allergenNotes: formData.allergenNotes || 'No undeclared allergens.',
        },
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Post Surplus Food Donation" maxWidth="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Food Name & Type */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Item / Preparation Name *
            </label>
            <input
              type="text"
              required
              value={formData.foodName}
              onChange={(e) => setFormData({ ...formData, foodName: e.target.value })}
              placeholder="e.g. Executive Buffet: Dal Makhani, Rice & Naan"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Category
            </label>
            <select
              value={formData.foodType}
              onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
            >
              <option value="cooked_meals">Cooked Meals (Hot)</option>
              <option value="bakery">Bakery & Breads</option>
              <option value="packaged_food">Packaged Grocery</option>
              <option value="fresh_produce">Fresh Fruits / Veg</option>
              <option value="dairy">Dairy Products</option>
            </select>
          </div>
        </div>

        {/* Venue Type & Dietary Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Donor Venue Type
            </label>
            <select
              value={formData.venueType}
              onChange={(e) => setFormData({ ...formData, venueType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
            >
              <option value="HOTELS">HOTELS (Hotels, Resorts & Luxury Banquets)</option>
              <option value="Resturant">Resturant (Restaurants, Cafes & Bistros)</option>
              <option value="Event venue">Event venue (Weddings, Conventions & Catering)</option>
              <option value="Others">Others (Hostels, Food Courts & Community)</option>
            </select>
          </div>
        </div>

        {/* Quantity, Units & Dietary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity Available *
            </label>
            <input
              type="number"
              min="1"
              required
              value={formData.initialQuantity}
              onChange={(e) => setFormData({ ...formData, initialQuantity: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Unit
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
            >
              <option value="servings">Servings / Meals</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="packets">Packets / Trays</option>
              <option value="boxes">Boxes / Crates</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dietary Type
            </label>
            <select
              value={formData.dietaryCategory}
              onChange={(e) => setFormData({ ...formData, dietaryCategory: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500 text-sm bg-white"
            >
              <option value="veg">Vegetarian</option>
              <option value="non_veg">Non-Vegetarian</option>
              <option value="vegan">100% Vegan</option>
            </select>
          </div>
        </div>

        {/* Expiry Window & Safety Buffer */}
        <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Expiry Deadline & Safety Buffer (Algorithmic Rescue Guard)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Safe Consumption Window (from now):
              </label>
              <select
                value={formData.hoursUntilExpiry}
                onChange={(e) => setFormData({ ...formData, hoursUntilExpiry: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
              >
                <option value="1.5">1.5 hours (High Urgency / Immediate Pick)</option>
                <option value="2.5">2.5 hours (Standard Hot Meal)</option>
                <option value="4">4.0 hours (Chilled / Insulated)</option>
                <option value="8">8.0 hours (Bakery / Produce)</option>
                <option value="24">24 hours (Packaged Goods)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Safety Buffer Before Strict Cut-off:
              </label>
              <select
                value={formData.safetyBufferMinutes}
                onChange={(e) => setFormData({ ...formData, safetyBufferMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl border border-amber-300 bg-white text-sm"
              >
                <option value="30">30 minutes safety margin</option>
                <option value="45">45 minutes safety margin (Recommended)</option>
                <option value="60">60 minutes safety margin (Hot buffet)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Photo Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
            Food Photo Representation
          </label>
          <div className="grid grid-cols-4 gap-2">
            {SAMPLE_IMAGES.map((img) => (
              <button
                key={img.url}
                type="button"
                onClick={() => setFormData({ ...formData, imageUrl: img.url })}
                className={`relative rounded-xl overflow-hidden border-2 aspect-video transition-all ${
                  formData.imageUrl === img.url ? 'border-rose-600 ring-2 ring-rose-400' : 'border-slate-200 opacity-60'
                }`}
              >
                <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-slate-900/70 text-[10px] text-white py-0.5 text-center font-medium">
                  {img.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Pickup Location */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-500" />
              Pickup Street Address
            </label>
            <input
              type="text"
              required
              value={formData.pickupAddress}
              onChange={(e) => setFormData({ ...formData, pickupAddress: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Landmark / Loading Bay
            </label>
            <input
              type="text"
              value={formData.pickupLandmark}
              onChange={(e) => setFormData({ ...formData, pickupLandmark: e.target.value })}
              placeholder="e.g. Service Gate 3, near security desk"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
            />
          </div>
        </div>

        {/* Food Safety Checklist Declarations */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/70 space-y-2">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5 mb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Mandatory Food Safety & Hygiene Declarations
          </div>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.declarations.hygieneChecked}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  declarations: { ...formData.declarations, hygieneChecked: e.target.checked },
                })
              }
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>Food was cooked / handled in a certified hygienic environment</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.declarations.temperatureSafe}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  declarations: { ...formData.declarations, temperatureSafe: e.target.checked },
                })
              }
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>Appropriate hot/cold holding temperatures maintained since preparation</span>
          </label>

          <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.declarations.sealedPacks}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  declarations: { ...formData.declarations, sealedPacks: e.target.checked },
                })
              }
              className="rounded text-rose-600 focus:ring-rose-500 w-4 h-4"
            />
            <span>Packed in food-grade, leak-proof containers ready for transit</span>
          </label>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-sm shadow-md shadow-rose-600/30 transition flex items-center gap-2 active:scale-95 disabled:opacity-50"
          >
            <Utensils className="w-4 h-4" />
            <span>{submitting ? 'Publishing...' : 'Publish Surplus Donation'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
