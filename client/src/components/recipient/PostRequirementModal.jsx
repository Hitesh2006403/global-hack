import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { Home, Clock, AlertTriangle, Send } from 'lucide-react';

export const PostRequirementModal = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { postRequirement } = useDonations();

  const [formData, setFormData] = useState({
    foodType: 'cooked_meals',
    quantityNeeded: 40,
    unit: 'servings',
    dietaryPreference: 'veg',
    urgency: 'HIGH',
    neededInHours: 2,
    location: currentUser?.address || '14 Sunshine Cross, Near St. Anne School',
    contactPerson: currentUser?.name || 'Sister Teresa',
    specialNotes: 'Feeding 40 children for evening dinner.',
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const neededBefore = new Date(Date.now() + formData.neededInHours * 60 * 60 * 1000).toISOString();

      await postRequirement({
        recipientId: currentUser?.id || 'recipient-1',
        recipientName: currentUser?.organizationName || currentUser?.name || 'Grace Hope Shelter',
        foodType: formData.foodType,
        quantityNeeded: Number(formData.quantityNeeded),
        unit: formData.unit,
        dietaryPreference: formData.dietaryPreference,
        urgency: formData.urgency,
        neededBefore,
        location: formData.location,
        contactPerson: formData.contactPerson,
        specialNotes: formData.specialNotes,
      });

      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Submit Food Need / Requirement">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Type Needed
            </label>
            <select
              value={formData.foodType}
              onChange={(e) => setFormData({ ...formData, foodType: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="cooked_meals">Cooked Meals (Ready to Eat)</option>
              <option value="bakery">Bakery / Breads</option>
              <option value="packaged_food">Packaged Grocery / Dry Staples</option>
              <option value="fresh_produce">Fresh Fruits & Vegetables</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Urgency Level
            </label>
            <select
              value={formData.urgency}
              onChange={(e) => setFormData({ ...formData, urgency: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white font-semibold text-rose-700"
            >
              <option value="HIGH">CRITICAL / Needed Immediately (Tonight)</option>
              <option value="MEDIUM">MODERATE / Next 6-8 Hours</option>
              <option value="STANDARD">STANDARD / Next 24 Hours</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Quantity Needed *
            </label>
            <input
              type="number"
              min="1"
              required
              value={formData.quantityNeeded}
              onChange={(e) => setFormData({ ...formData, quantityNeeded: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Unit
            </label>
            <select
              value={formData.unit}
              onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="servings">Servings</option>
              <option value="kg">Kilograms (kg)</option>
              <option value="packets">Packets</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Dietary Filter
            </label>
            <select
              value={formData.dietaryPreference}
              onChange={(e) => setFormData({ ...formData, dietaryPreference: e.target.value })}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
            >
              <option value="veg">Vegetarian</option>
              <option value="non_veg">Non-Vegetarian</option>
              <option value="any">Any Safe Food</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Needed Within:
          </label>
          <select
            value={formData.neededInHours}
            onChange={(e) => setFormData({ ...formData, neededInHours: Number(e.target.value) })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="1.5">Within 1.5 hours</option>
            <option value="2.5">Within 2.5 hours (Recommended for hot meals)</option>
            <option value="6">Within 6 hours</option>
            <option value="12">Within 12 hours</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Delivery / Drop Location
          </label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Special Notes for Kitchen or Riders
          </label>
          <textarea
            rows="2"
            value={formData.specialNotes}
            onChange={(e) => setFormData({ ...formData, specialNotes: e.target.value })}
            placeholder="e.g. Children shelter, mild spice preferred"
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{submitting ? 'Broadcasting...' : 'Broadcast Requirement'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
