import React from 'react';
import {
  MapPin,
  Phone,
  Navigation,
  Clock,
  QrCode,
  ShieldAlert,
  CheckCircle2,
  Bike,
  ArrowRight,
  Scan,
} from 'lucide-react';

export const DeliveryTaskCard = ({
  task,
  onUpdateStatus,
  onOpenPickupScan,
  onOpenReceiptQr,
}) => {
  const isDelivered = task.currentMilestone === 'DELIVERED';
  const isPickedUp = task.currentMilestone === 'PICKED_UP';
  const isPickupStage = !isPickedUp && !isDelivered;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between">
      <div>
        {/* Top Header */}
        <div className="bg-slate-50 border-b border-slate-100 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
              <Bike className="w-4 h-4" />
            </span>
            <div>
              <div className="text-xs font-bold text-slate-800">{task.foodName}</div>
              <div className="text-[11px] text-slate-500">{task.quantity} • {task.storageCondition}</div>
            </div>
          </div>
          <span
            className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
              isDelivered
                ? 'bg-teal-100 text-teal-800 border border-teal-300'
                : isPickedUp
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : 'bg-amber-100 text-amber-800 border border-amber-300'
            }`}
          >
            {task.currentMilestone.replace(/_/g, ' ')}
          </span>
        </div>

        {/* Route Steps */}
        <div className="p-4 space-y-4">
          {/* Pickup Point */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Pickup Location (Donor)</div>
              <div className="text-xs font-semibold text-slate-800 truncate">{task.pickup?.donorName}</div>
              <div className="text-xs text-slate-500 truncate">{task.pickup?.location}</div>
              <a
                href={`tel:${task.pickup?.donorPhone}`}
                className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline mt-0.5"
              >
                <Phone className="w-3 h-3" />
                <span>Call Kitchen ({task.pickup?.donorPhone})</span>
              </a>
            </div>
          </div>

          {/* Drop-off Point */}
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Drop-off Shelter (Recipient)</div>
              <div className="text-xs font-semibold text-slate-800 truncate">{task.dropoff?.recipientName}</div>
              <div className="text-xs text-slate-500 truncate">{task.dropoff?.location}</div>
              <a
                href={`tel:${task.dropoff?.recipientPhone}`}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-600 hover:underline mt-0.5"
              >
                <Phone className="w-3 h-3" />
                <span>Call Recipient ({task.dropoff?.recipientPhone})</span>
              </a>
            </div>
          </div>

          {/* Thermal Container Advice */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-2.5 text-[11px] text-amber-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Load Advice: {task.vehicleSuggestion || 'Use insulated delivery carrier'}</span>
          </div>
        </div>
      </div>

      {/* Action Milestones */}
      <div className="p-4 pt-0 space-y-2">
        {/* Stage 1 Pickup Scanner Action */}
        {isPickupStage && (
          <button
            onClick={() => onOpenPickupScan(task)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
          >
            <Scan className="w-4 h-4" />
            <span>Scan Donor Pickup QR Code</span>
          </button>
        )}

        {/* Stage 2 In-Transit: Show Receipt QR to Shelter */}
        {isPickedUp && (
          <button
            onClick={() => onOpenReceiptQr(task)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-teal-600 hover:from-purple-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2"
          >
            <QrCode className="w-4 h-4" />
            <span>Show Recipient Receipt QR Code (Stage 2)</span>
          </button>
        )}

        {isDelivered && (
          <div className="w-full py-2 px-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center justify-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Handover Complete & Food Rescued!</span>
          </div>
        )}
      </div>
    </div>
  );
};
