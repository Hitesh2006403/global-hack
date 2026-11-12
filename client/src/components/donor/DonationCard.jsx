import React from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { ExpiryTimer } from '../common/ExpiryTimer';
import {
  MapPin,
  QrCode,
  RotateCw,
  Users,
  ShieldCheck,
  CheckCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const DonationCard = ({ donation, onShowQr, onReopen }) => {
  const isPartiallyClaimed = donation.status === 'PARTIALLY_ACCEPTED';
  const isEligibleToReopen = donation.status === 'CANCELLED' || (isPartiallyClaimed && donation.remainingQuantity > 0);

  const percentClaimed = Math.round(
    ((donation.initialQuantity - donation.remainingQuantity) / donation.initialQuantity) * 100
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between">
      <div>
        {/* Card Header with Image and Badges */}
        <div className="relative h-44 w-full bg-slate-100 overflow-hidden">
          <img
            src={donation.imageUrl || 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=600&q=80'}
            alt={donation.foodName}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-black/20" />

          {/* Top Status Badges */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={donation.status} />
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-xs ${
              donation.dietaryCategory === 'veg'
                ? 'bg-emerald-600 text-white border-emerald-400'
                : donation.dietaryCategory === 'vegan'
                ? 'bg-teal-600 text-white border-teal-400'
                : 'bg-rose-600 text-white border-rose-400'
            }`}>
              {donation.dietaryCategory}
            </span>
            {donation.venueType && (
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-amber-300 border border-amber-300/30">
                {donation.venueType}
              </span>
            )}
          </div>

          {/* Unit & Storage Badge */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs">
            <span className="bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg font-medium">
              {donation.foodType?.replace('_', ' ').toUpperCase()}
            </span>
            <span className="bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg font-medium capitalize">
              {donation.storageCondition?.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 space-y-4">
          <div>
            <h4 className="font-bold text-base text-slate-800 line-clamp-1 leading-snug">
              {donation.foodName}
            </h4>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
              <span className="truncate">{donation.pickupLocation?.address}</span>
            </div>
          </div>

          {/* Quantity Progress Tracker */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">Remaining Surplus</span>
              <span className="text-slate-900 font-bold">
                {donation.remainingQuantity} / {donation.initialQuantity} {donation.unit}
              </span>
            </div>
            {/* Visual Bar */}
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  donation.remainingQuantity === 0 ? 'bg-slate-400' : 'bg-gradient-to-r from-rose-500 to-amber-500'
                }`}
                style={{ width: `${Math.max(5, (donation.remainingQuantity / donation.initialQuantity) * 100)}%` }}
              />
            </div>
            {donation.initialQuantity > donation.remainingQuantity && (
              <p className="text-[11px] text-emerald-700 font-medium">
                ✓ {donation.initialQuantity - donation.remainingQuantity} {donation.unit} successfully claimed!
              </p>
            )}
          </div>

          {/* Live Expiry Countdown */}
          {donation.status !== 'COMPLETED' && donation.status !== 'EXPIRED' && (
            <ExpiryTimer
              expiryDeadline={donation.expiryDeadline}
              safetyBufferMinutes={donation.safetyBufferMinutes}
            />
          )}

          {/* Matched Recipients or Claim details */}
          {donation.matchedRecipients && donation.matchedRecipients.length > 0 && (
            <div className="text-xs border-t border-slate-100 pt-3 space-y-1">
              <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-indigo-500" />
                Matched Beneficiaries
              </div>
              {donation.matchedRecipients.map((rec, i) => (
                <div key={i} className="flex items-center justify-between text-slate-700 bg-slate-50 px-2 py-1 rounded">
                  <span className="truncate font-medium">{rec.recipientName}</span>
                  <span className="text-emerald-700 font-bold shrink-0">
                    +{rec.claimedQuantity || 0} claimed
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Food Safety Affirmation */}
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 bg-emerald-50/70 border border-emerald-100 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="truncate">Hygienic prep verified • Sealed packaging</span>
          </div>
        </div>
      </div>

      {/* Card Action Footer */}
      <div className="p-5 pt-0 flex items-center gap-2">
        <button
          onClick={() => onShowQr(donation)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-slate-700 text-xs font-semibold shadow-2xs hover:bg-slate-50 transition"
        >
          <QrCode className="w-4 h-4 text-slate-600" />
          <span>Handover QR</span>
        </button>

        {isEligibleToReopen && (
          <button
            onClick={() => onReopen(donation)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold transition"
          >
            <RotateCw className="w-3.5 h-3.5 text-amber-700" />
            <span>Reopen & Rematch</span>
          </button>
        )}
      </div>
    </div>
  );
};
