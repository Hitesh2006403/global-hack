import React from 'react';
import { useDonations } from '../../context/DonationContext';
import { useNotification } from '../../context/NotificationContext';
import { ExpiryTimer } from './ExpiryTimer';
import { Flame, PhoneCall, AlertCircle } from 'lucide-react';

export const UrgentTicker = () => {
  const { donations } = useDonations();
  const { triggerAiVoiceCall } = useNotification();

  // Find urgent donations that still have food and expire within 3 hours
  const urgentItems = donations.filter((d) => {
    if (d.status !== 'AVAILABLE' && d.status !== 'PARTIALLY_ACCEPTED' && d.status !== 'REOPENED') {
      return false;
    }
    const diffHours = (new Date(d.expiryDeadline).getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours < 3.5;
  });

  if (urgentItems.length === 0) return null;

  const topUrgent = urgentItems[0];

  return (
    <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 text-white px-4 py-2.5 text-xs sm:text-sm font-medium shadow-md">
      <div className="max-w-[1680px] w-full mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 flex-1 min-w-[280px]">
          <span className="flex items-center gap-1 bg-white/20 text-white font-bold text-[11px] px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 animate-pulse">
            <Flame className="w-3.5 h-3.5 text-amber-300" />
            Urgent Rescue Alert
          </span>
          <span className="truncate">
            <strong className="font-semibold">{topUrgent.foodName}</strong> ({topUrgent.remainingQuantity} {topUrgent.unit}) from {topUrgent.donorName}
          </span>
          <div className="shrink-0 bg-white/10 rounded px-1.5 py-0.5">
            <ExpiryTimer
              expiryDeadline={topUrgent.expiryDeadline}
              safetyBufferMinutes={topUrgent.safetyBufferMinutes}
              compact
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() =>
              triggerAiVoiceCall({
                foodName: topUrgent.foodName,
                recipientPhone: '+91 91234 56789',
                recipientName: 'Grace Hope Children Shelter',
                expiryLeft: 'Critical window active',
              })
            }
            className="flex items-center gap-1.5 bg-white text-rose-700 hover:bg-amber-50 active:scale-95 font-semibold text-xs px-3 py-1 rounded-full shadow transition"
          >
            <PhoneCall className="w-3.5 h-3.5 text-rose-600" />
            <span>Simulate AI Voice Call</span>
          </button>
        </div>
      </div>
    </div>
  );
};
