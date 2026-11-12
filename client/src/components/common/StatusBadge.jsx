import React from 'react';

const STATUS_CONFIG = {
  AVAILABLE: {
    label: 'Available',
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  PARTIALLY_ACCEPTED: {
    label: 'Partially Claimed',
    bg: 'bg-amber-50 text-amber-700 border-amber-200',
    dot: 'bg-amber-500 animate-pulse',
  },
  ACCEPTED: {
    label: 'Fully Claimed',
    bg: 'bg-blue-50 text-blue-700 border-blue-200',
    dot: 'bg-blue-500',
  },
  PICKUP_SCHEDULED: {
    label: 'Pickup Scheduled',
    bg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    dot: 'bg-indigo-500',
  },
  OUT_FOR_DELIVERY: {
    label: 'Out for Delivery',
    bg: 'bg-purple-50 text-purple-700 border-purple-200',
    dot: 'bg-purple-500 animate-pulse',
  },
  COMPLETED: {
    label: 'Rescued & Delivered',
    bg: 'bg-teal-50 text-teal-800 border-teal-200',
    dot: 'bg-teal-600',
  },
  CANCELLED: {
    label: 'Cancelled',
    bg: 'bg-rose-50 text-rose-700 border-rose-200',
    dot: 'bg-rose-500',
  },
  REOPENED: {
    label: 'Reopened & Rematching',
    bg: 'bg-orange-50 text-orange-700 border-orange-200',
    dot: 'bg-orange-500 animate-ping',
  },
  EXPIRED: {
    label: 'Expired',
    bg: 'bg-slate-100 text-slate-600 border-slate-300',
    dot: 'bg-slate-400',
  },
};

export const StatusBadge = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-500',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};
