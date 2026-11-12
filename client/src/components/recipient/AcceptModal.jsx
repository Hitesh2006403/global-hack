import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { HeartHandshake, CheckCircle2, Split, Clock, MapPin } from 'lucide-react';

export const AcceptModal = ({ isOpen, onClose, donation }) => {
  const { currentUser } = useAuth();
  const { acceptDonation } = useDonations();

  const maxQty = donation ? donation.remainingQuantity : 1;
  const [claimQuantity, setClaimQuantity] = useState(maxQty);
  const [pickupSlot, setPickupSlot] = useState('Immediate pickup (Within 45 mins)');
  const [submitting, setSubmitting] = useState(false);

  // Sync state if donation changes
  React.useEffect(() => {
    if (donation) {
      setClaimQuantity(donation.remainingQuantity);
    }
  }, [donation]);

  if (!donation) return null;

  const remainingAfterClaim = maxQty - Number(claimQuantity);

  const handleClaim = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await acceptDonation({
        donationId: donation.id,
        recipientId: currentUser?.id || 'recipient-1',
        recipientName: currentUser?.organizationName || currentUser?.name || 'Grace Hope Shelter',
        quantityAccepted: Number(claimQuantity),
        notes: pickupSlot,
      });
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Claim Food Donation (Split Allowed)">
      <form onSubmit={handleClaim} className="space-y-4">
        {/* Item Summary Header */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center gap-3">
          <img
            src={donation.imageUrl || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'}
            alt={donation.foodName}
            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm text-slate-800 line-clamp-1">{donation.foodName}</h4>
            <p className="text-xs text-slate-500">{donation.donorName}</p>
            <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-1">
              <MapPin className="w-3 h-3 text-slate-400" />
              <span className="truncate">{donation.pickupLocation?.address}</span>
            </div>
          </div>
        </div>

        {/* Split Donation / Quantity Selector */}
        <div className="border border-amber-200 bg-amber-50/50 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900 uppercase">
            <span className="flex items-center gap-1.5">
              <Split className="w-4 h-4 text-amber-600" />
              Split Donation / Partial Acceptance
            </span>
            <span>Total Available: {maxQty} {donation.unit}</span>
          </div>

          <p className="text-xs text-slate-600">
            Take only what your organization can consume immediately. Leftover food will remain active for other shelters.
          </p>

          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-slate-700">Allocated to you:</span>
              <span className="text-xl text-rose-600 font-extrabold font-mono">
                {claimQuantity} {donation.unit}
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="1"
              max={maxQty}
              value={claimQuantity}
              onChange={(e) => setClaimQuantity(Number(e.target.value))}
              className="w-full accent-rose-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
            />

            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>Min: 1 {donation.unit}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setClaimQuantity(Math.ceil(maxQty / 2))}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-[10px]"
                >
                  Half (50%)
                </button>
                <button
                  type="button"
                  onClick={() => setClaimQuantity(maxQty)}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 hover:bg-slate-50 text-[10px]"
                >
                  Full (100%)
                </button>
              </div>
              <span>Max: {maxQty} {donation.unit}</span>
            </div>
          </div>

          {/* Real-time remaining preview */}
          <div className="text-xs pt-2 border-t border-amber-200/70 flex items-center justify-between text-amber-800">
            <span>Remaining for other shelters:</span>
            <span className="font-bold font-mono">
              {remainingAfterClaim} {donation.unit}
            </span>
          </div>
        </div>

        {/* Pickup slot selection */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            Pickup Window / Scheduling
          </label>
          <select
            value={pickupSlot}
            onChange={(e) => setPickupSlot(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white"
          >
            <option value="Immediate pickup (Within 45 mins)">Immediate pickup (Dispatch Rapid Fleet now)</option>
            <option value="Scheduled between 7:00 PM - 8:00 PM">Scheduled between 7:00 PM - 8:00 PM</option>
            <option value="Self-pickup by shelter volunteer">Self-pickup by shelter volunteer vehicle</option>
          </select>
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
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white font-bold text-xs shadow-md shadow-rose-600/30 transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Confirming Claim...' : `Confirm Claim (${claimQuantity} ${donation.unit})`}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
