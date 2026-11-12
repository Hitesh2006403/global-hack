import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { DeliveryTaskCard } from '../components/delivery/DeliveryTaskCard';
import { QrVerifyModal } from '../components/delivery/QrVerifyModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { ReviewsSection } from '../components/common/ReviewsSection';
import { Bike, ShieldCheck, MapPin, CheckCircle2, AlertTriangle, QrCode } from 'lucide-react';

export const DeliveryDashboard = () => {
  const { currentUser } = useAuth();
  const { deliveryTasks, updateDeliveryMilestone, donations } = useDonations();
  const [selectedTaskForPickupScan, setSelectedTaskForPickupScan] = useState(null);
  const [selectedDonationForReceiptQr, setSelectedDonationForReceiptQr] = useState(null);
  const [explicitReceiptToken, setExplicitReceiptToken] = useState(null);

  const activeTasks = deliveryTasks.filter((t) => t.currentMilestone !== 'DELIVERED');
  const completedTasks = deliveryTasks.filter((t) => t.currentMilestone === 'DELIVERED');

  const handleOpenReceiptQr = (task, token) => {
    const matchingDonation = donations.find((d) => d.id === task.donationId) || {
      id: task.donationId,
      foodName: task.foodName,
      status: 'PICKED_UP',
    };
    setSelectedDonationForReceiptQr(matchingDonation);
    setExplicitReceiptToken(token || null);
  };

  return (
    <div className="space-y-6">
      {/* Rider Status Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-blue-200">
            <Bike className="w-3.5 h-3.5" />
            <span>Delivery Fleet Dispatch • {currentUser?.name || 'Vikram Singh (Rider #42)'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Rapid Rescue Transit Hub
          </h2>
          <p className="text-sm text-blue-100/90 leading-relaxed">
            Ensure hot food stays hot and chilled goods stay cold. Complete Stage 1 Donor Pickup verification, inspect safety seal packaging, and present Stage 2 Receipt QR tokens upon arrival at shelters.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-semibold">
            <span className="bg-blue-800/80 px-3 py-1.5 rounded-xl border border-blue-600/60">
              🛵 Vehicle: {currentUser?.vehicleType || 'Electric Cargo Scooter (KA-01-EQ-9872)'}
            </span>
            <span className="bg-emerald-800/80 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-600/60">
              ⭐ Rider Rating: {currentUser?.rating || '4.95'} / 5.0
            </span>
          </div>
        </div>
      </div>

      {/* Task Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Assigned Deliveries</span>
            <span className="text-xs bg-amber-100 text-amber-800 font-extrabold px-2.5 py-0.5 rounded-full">
              {activeTasks.length} In Progress
            </span>
          </h3>
          <span className="text-xs text-slate-500">Live GPS Distance Estimated</span>
        </div>

        {activeTasks.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500 text-xs">
            No active pickup tasks assigned right now. You are ready on standby.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeTasks.map((task) => (
              <DeliveryTaskCard
                key={task.id}
                task={task}
                onUpdateStatus={(taskId, milestone) => updateDeliveryMilestone(taskId, milestone)}
                onOpenPickupScan={(t) => setSelectedTaskForPickupScan(t)}
                onOpenReceiptQr={(t) => handleOpenReceiptQr(t)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Runs */}
      {completedTasks.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-slate-200">
          <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>Completed Rescues Today</span>
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {completedTasks.map((task) => (
              <DeliveryTaskCard
                key={task.id}
                task={task}
                onUpdateStatus={() => {}}
                onOpenPickupScan={() => {}}
                onOpenReceiptQr={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* REVIEWS & COMMUNITY FEEDBACK */}
      <div className="pt-4 border-t border-slate-200">
        <ReviewsSection />
      </div>

      {/* STAGE 1: Pickup QR Verify Scanner Modal */}
      <QrVerifyModal
        isOpen={!!selectedTaskForPickupScan}
        onClose={() => setSelectedTaskForPickupScan(null)}
        task={selectedTaskForPickupScan}
        onOpenReceiptQr={(task, token) => handleOpenReceiptQr(task, token)}
      />

      {/* STAGE 2: Recipient Receipt QR Code Modal (Presented by Rider to Shelter) */}
      <QrCodeModal
        isOpen={!!selectedDonationForReceiptQr}
        onClose={() => {
          setSelectedDonationForReceiptQr(null);
          setExplicitReceiptToken(null);
        }}
        donation={selectedDonationForReceiptQr}
        stage="RECEIPT"
        explicitToken={explicitReceiptToken}
      />
    </div>
  );
};
