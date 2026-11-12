import React, { useState } from 'react';
import { StatusBadge } from '../common/StatusBadge';
import { ExpiryTimer } from '../common/ExpiryTimer';
import { Search, Filter, RotateCw, QrCode, ExternalLink } from 'lucide-react';

export const DonationMonitorTable = ({ donations, onOpenQr, onReopen }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = donations.filter((d) => {
    const matchesSearch =
      d.foodName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.donorName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || d.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Table Filter Header */}
      <div className="p-4 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-sm text-slate-800">Live Donations Audit Log</h4>
          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-0.5 rounded-full font-mono">
            {filtered.length} records
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search donor or food..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-300 text-xs w-48 focus:ring-2 focus:ring-rose-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl border border-slate-300 text-xs bg-white text-slate-700"
          >
            <option value="ALL">All Statuses</option>
            <option value="AVAILABLE">Available</option>
            <option value="PARTIALLY_ACCEPTED">Partially Accepted</option>
            <option value="PICKUP_SCHEDULED">Pickup Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="REOPENED">Reopened</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
            <tr>
              <th className="py-3 px-4">Item & Donor</th>
              <th className="py-3 px-4">Remaining / Initial</th>
              <th className="py-3 px-4">Expiry Window</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50/50 transition">
                <td className="py-3 px-4">
                  <div className="font-bold text-slate-800 line-clamp-1">{d.foodName}</div>
                  <div className="text-[11px] text-slate-500">{d.donorName}</div>
                </td>
                <td className="py-3 px-4 font-mono font-medium">
                  {d.remainingQuantity} / {d.initialQuantity} {d.unit}
                </td>
                <td className="py-3 px-4">
                  <ExpiryTimer
                    expiryDeadline={d.expiryDeadline}
                    safetyBufferMinutes={d.safetyBufferMinutes}
                    compact
                  />
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={d.status} />
                </td>
                <td className="py-3 px-4 text-right space-x-2">
                  <button
                    onClick={() => onOpenQr(d)}
                    className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 transition inline-block"
                    title="View QR Token"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                  </button>
                  {d.status === 'CANCELLED' && (
                    <button
                      onClick={() => onReopen(d)}
                      className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold hover:bg-amber-100 transition inline-flex items-center gap-1"
                    >
                      <RotateCw className="w-3 h-3 text-amber-600" />
                      <span>Reopen</span>
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
