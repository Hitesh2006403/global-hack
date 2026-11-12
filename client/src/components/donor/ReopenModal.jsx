import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useDonations } from '../../context/DonationContext';
import { RotateCw, Sparkles, AlertCircle } from 'lucide-react';

export const ReopenModal = ({ isOpen, onClose, donation }) => {
  const { reopenDonation } = useDonations();
  const [notes, setNotes] = useState('Reopened for urgent redistribution to verified shelters in 3km radius');
  const [submitting, setSubmitting] = useState(false);

  if (!donation) return null;

  const handleReopen = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await reopenDonation(donation.id, notes);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reopen & Rematch Donation">
      <form onSubmit={handleReopen} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900 space-y-1">
          <div className="font-bold flex items-center gap-1.5 text-amber-800">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Smart Redistribution Workflow
          </div>
          <p>
            Reopening <strong>{donation.foodName}</strong> ({donation.remainingQuantity || donation.initialQuantity} {donation.unit}) will immediately notify nearby verified recipients and priority food rescue fleets.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Redistribution / Urgency Note
          </label>
          <textarea
            rows="3"
            required
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-amber-500"
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
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <RotateCw className="w-4 h-4 animate-spin-hover" />
            <span>{submitting ? 'Rematching...' : 'Confirm & Rematch Now'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
