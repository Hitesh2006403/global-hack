import React, { useState } from 'react';
import { useDonations } from '../../context/DonationContext';
import { ReviewModal } from './ReviewModal';
import { formatRelativeTime } from '../../utils/dateUtils';
import {
  Star,
  MessageSquare,
  ShieldCheck,
  PlusCircle,
  ThumbsUp,
  Sparkles,
  Quote,
} from 'lucide-react';

export const ReviewsSection = () => {
  const { reviews } = useDonations();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterRole, setFilterRole] = useState('ALL');

  const filtered = reviews.filter((r) => {
    if (filterRole === 'ALL') return true;
    return r.authorRole === filterRole;
  });

  const averageRating =
    reviews.length > 0
      ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length).toFixed(1)
      : '4.9';

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-8 shadow-xs space-y-6">
      {/* Header and Aggregate Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
            </span>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">
              Community Reviews & Handover Feedback
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real feedback from partner kitchens, orphanages, and verified rapid rescue riders
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Average Rating Pill */}
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200/80 px-3.5 py-1.5 rounded-2xl">
            <div className="text-xl font-black text-amber-600">{averageRating}</div>
            <div className="text-[11px] text-amber-900 font-semibold leading-tight">
              <div>★★★★★</div>
              <div className="text-slate-400 font-normal">{reviews.length} Verified Reviews</div>
            </div>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-rose-600/20 active:scale-95 transition flex items-center gap-1.5"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Write Feedback</span>
          </button>
        </div>
      </div>

      {/* Reviews Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((rev) => (
          <div
            key={rev.id}
            className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-5 flex flex-col justify-between hover:border-amber-300 hover:bg-amber-50/20 transition-all duration-200 shadow-2xs"
          >
            <div className="space-y-3">
              {/* Star Rating and Verification */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 text-amber-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${
                        i < Math.floor(rev.rating || 5)
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-300'
                      }`}
                    />
                  ))}
                  <span className="text-xs font-bold text-slate-700 ml-1.5">{rev.rating}</span>
                </div>

                <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100/80 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Verified Handover
                </span>
              </div>

              {/* Food Name Context */}
              <div className="text-xs font-bold text-slate-800 line-clamp-1">
                {rev.foodName}
              </div>

              {/* Comment */}
              <p className="text-xs text-slate-600 leading-relaxed italic bg-white p-3 rounded-xl border border-slate-100">
                "{rev.comment}"
              </p>

              {/* Tags */}
              {rev.tags && rev.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {rev.tags.map((tag, i) => (
                    <span
                      key={i}
                      className="text-[10px] font-semibold bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-md"
                    >
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Author Attribution Footer */}
            <div className="pt-4 border-t border-slate-200/60 mt-4 flex items-center justify-between text-[11px] text-slate-500">
              <div>
                <span className="font-bold text-slate-800 block">{rev.recipientName}</span>
                <span className="text-[10px] text-slate-400">To {rev.donorName}</span>
              </div>
              <span className="text-[10px] font-mono">{formatRelativeTime(rev.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Review Modal */}
      <ReviewModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
