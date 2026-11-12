import React from 'react';
import { Utensils, Leaf, CheckCircle2, Clock, Users, Flame } from 'lucide-react';

export const MetricsGrid = ({ metrics }) => {
  if (!metrics) return null;

  const STATS = [
    {
      label: 'Meals Rescued',
      value: metrics.totalMealsRescued?.toLocaleString(),
      change: '+18% this week',
      icon: Utensils,
      bg: 'bg-amber-500/10 text-amber-600 border-amber-200',
    },
    {
      label: 'CO₂ Emissions Prevented',
      value: `${metrics.totalCo2PreventedKg?.toLocaleString()} kg`,
      change: 'Calculated via IPCC factor',
      icon: Leaf,
      bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-200',
    },
    {
      label: 'Avg Time-to-Match',
      value: `${metrics.averageTimeToMatchMinutes} mins`,
      change: 'Sub-15m target met',
      icon: Clock,
      bg: 'bg-blue-500/10 text-blue-600 border-blue-200',
    },
    {
      label: 'Rescue Success Rate',
      value: `${metrics.rescueSuccessPercentage}%`,
      change: 'Rescued before expiry',
      icon: CheckCircle2,
      bg: 'bg-rose-500/10 text-rose-600 border-rose-200',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {STATS.map((s, i) => {
        const Icon = s.icon;
        return (
          <div
            key={i}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {s.label}
              </span>
              <div className={`p-2 rounded-xl border ${s.bg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div>
              <div className="text-2xl font-black text-slate-900 tracking-tight">{s.value}</div>
              <div className="text-[11px] font-medium text-slate-400 mt-0.5">{s.change}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
