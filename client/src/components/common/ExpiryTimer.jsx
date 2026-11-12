import React, { useState, useEffect } from 'react';
import { getTimeRemaining } from '../../utils/dateUtils';
import { Clock, AlertTriangle } from 'lucide-react';

export const ExpiryTimer = ({ expiryDeadline, safetyBufferMinutes = 0, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState(() =>
    getTimeRemaining(expiryDeadline, safetyBufferMinutes)
  );

  useEffect(() => {
    // Tick every second for live countdown
    const timer = setInterval(() => {
      setTimeLeft(getTimeRemaining(expiryDeadline, safetyBufferMinutes));
    }, 1000);

    return () => clearInterval(timer);
  }, [expiryDeadline, safetyBufferMinutes]);

  if (timeLeft.isExpired) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-1 rounded border border-rose-200">
        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
        Safe Window Passed
      </span>
    );
  }

  // Dynamic urgency color coding
  let colorClass = 'text-emerald-700 bg-emerald-50 border-emerald-200';
  let iconClass = 'text-emerald-600';

  if (timeLeft.isCritical) {
    colorClass = 'text-rose-700 bg-rose-50 border-rose-200 animate-pulse font-bold';
    iconClass = 'text-rose-600';
  } else if (timeLeft.isExpiringSoon) {
    colorClass = 'text-amber-700 bg-amber-50 border-amber-200';
    iconClass = 'text-amber-600';
  }

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border ${colorClass}`}>
        <Clock className={`w-3 h-3 ${iconClass}`} />
        <span>{timeLeft.label}</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center justify-between text-xs px-2.5 py-1.5 rounded-md border ${colorClass}`}>
      <div className="flex items-center gap-1.5">
        <Clock className={`w-3.5 h-3.5 ${iconClass}`} />
        <span className="font-semibold">{timeLeft.label}</span>
      </div>
      {safetyBufferMinutes > 0 && (
        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-medium ml-2">
          Incl. {safetyBufferMinutes}m buffer
        </span>
      )}
    </div>
  );
};
