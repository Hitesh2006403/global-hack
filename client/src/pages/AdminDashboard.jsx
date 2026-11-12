import React, { useState } from 'react';
import { useDonations } from '../context/DonationContext';
import { MetricsGrid } from '../components/admin/MetricsCard';
import { DonationMonitorTable } from '../components/admin/DonationMonitorTable';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { ReopenModal } from '../components/donor/ReopenModal';
import { VerifiedTelemetryPanel } from '../components/admin/VerifiedTelemetryPanel';
import {
  ShieldAlert,
  AlertTriangle,
  Activity,
  CheckCircle,
  Clock,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

export const AdminDashboard = () => {
  const { impactMetrics, donations } = useDonations();
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);
  const [selectedDonationForReopen, setSelectedDonationForReopen] = useState(null);

  // Critical items: expiring in < 1 hour without full claim
  const criticalItems = donations.filter((d) => {
    if (d.status === 'COMPLETED' || d.status === 'EXPIRED') return false;
    const diffMs = new Date(d.expiryDeadline).getTime() - Date.now();
    return diffMs > 0 && diffMs < 1.5 * 60 * 60 * 1000;
  });

  return (
    <div className="space-y-8">
      {/* Admin Operations Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-stone-900 to-rose-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg border border-slate-800">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 px-3 py-1 rounded-full text-xs font-semibold">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Central Operations & Impact Command</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Platform Health, Match Velocity & Handover Telemetry
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Real-time telemetry across donor kitchens, partner shelters, and rapid delivery riders. Audit verified served and received quantities with zero variance.
          </p>
        </div>
      </div>

      {/* Critical Platform Urgency Alerts */}
      {criticalItems.length > 0 && (
        <div className="bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-rose-600 animate-bounce" />
              <span>Urgent Attention Required ({criticalItems.length} Batch Approaching Expiry)</span>
            </div>
            <span className="text-[11px] font-mono font-bold bg-rose-200/80 text-rose-900 px-2 py-0.5 rounded">
              High Priority Dispatch
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {criticalItems.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-rose-200 rounded-xl p-3 flex items-center justify-between gap-3 shadow-2xs"
              >
                <div>
                  <div className="font-bold text-xs text-slate-900">{item.foodName}</div>
                  <div className="text-[11px] text-slate-500">
                    {item.donorName} • {item.remainingQuantity} {item.unit} remaining
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded border border-rose-200 shrink-0">
                  Cutoff in &lt;90m
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VERIFIED SERVED & RECEIVED AUDIT TELEMETRY (NEW FEATURE) */}
      <VerifiedTelemetryPanel />

      {/* High-Level Impact Metrics Grid */}
      <div className="space-y-3">
        <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Activity className="w-4 h-4 text-rose-600" />
          <span>Real-Time Environmental & Social Impact</span>
        </h3>
        <MetricsGrid metrics={impactMetrics} />
      </div>

      {/* Donation Audit Monitor Table */}
      <div className="space-y-3">
        <DonationMonitorTable
          donations={donations}
          onOpenQr={(don) => setSelectedDonationForQr(don)}
          onReopen={(don) => setSelectedDonationForReopen(don)}
        />
      </div>

      {/* Modals */}
      <QrCodeModal
        isOpen={!!selectedDonationForQr}
        onClose={() => setSelectedDonationForQr(null)}
        donation={selectedDonationForQr}
      />

      <ReopenModal
        isOpen={!!selectedDonationForReopen}
        onClose={() => setSelectedDonationForReopen(null)}
        donation={selectedDonationForReopen}
      />
    </div>
  );
};
