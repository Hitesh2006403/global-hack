import React, { useState } from 'react';
import { Modal } from './Modal';
import { useAuth } from '../../context/AuthContext';
import { useDonations } from '../../context/DonationContext';
import { Star, MessageSquare, ThumbsUp, Sparkles, CheckCircle2 } from 'lucide-react';

const SUGGESTED_TAGS = [
  'Fresh & Hot',
  'Hygienically Packed',
  'Punctual Handover',
  'Accurate Quantity',
  'Clear Labeling',
  'Polite Coordinator',
  'Leak-Proof Containers',
];

export const ReviewModal = ({ isOpen, onClose, defaultDonation = null }) => {
  const { currentUser } = useAuth();
  const { submitReview } = useDonations();

  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState(['Fresh & Hot', 'Hygienically Packed']);
  const [donorName, setDonorName] = useState(
    defaultDonation?.donorName || 'Grand Hyatt Banquet & Bistro'
  );
  const [foodName, setFoodName] = useState(
    defaultDonation?.foodName || 'Executive Buffet Meals'
  );
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;

    try {
      setSubmitting(true);
      await submitReview({
        donationId: defaultDonation?.id || 'don-' + Date.now().toString(36),
        donorName,
        recipientName: currentUser?.organizationName || currentUser?.name || 'Partner Shelter',
        authorRole: currentUser?.role || 'recipient',
        rating,
        foodName,
        comment: comment.trim(),
        tags: selectedTags,
      });

      setComment('');
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Share Food Rescue Feedback & Rating">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Rating Stars Header */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-center space-y-2">
          <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">
            Overall Experience & Quality Rating
          </div>

          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="p-1 transition-transform hover:scale-125 focus:outline-none"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoverRating || rating)
                      ? 'text-amber-400 fill-amber-400 filter drop-shadow'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="text-sm font-bold text-slate-800">
            {rating === 5 && '⭐⭐⭐⭐⭐ Exceptional (5.0 / 5.0)'}
            {rating === 4 && '⭐⭐⭐⭐ Very Good (4.0 / 5.0)'}
            {rating === 3 && '⭐⭐⭐ Good / Acceptable (3.0 / 5.0)'}
            {rating === 2 && '⭐⭐ Needs Improvement (2.0 / 5.0)'}
            {rating === 1 && '⭐ Poor Quality (1.0 / 5.0)'}
          </div>
        </div>

        {/* Food / Donor Context */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Food Item Rescued
            </label>
            <input
              type="text"
              required
              value={foodName}
              onChange={(e) => setFoodName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Donor Organization
            </label>
            <input
              type="text"
              required
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-medium"
            />
          </div>
        </div>

        {/* Quality Badges */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <ThumbsUp className="w-3.5 h-3.5 text-slate-500" />
            Quality & Hygiene Highlights
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                    isSelected
                      ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {isSelected ? `✓ ${tag}` : `+ ${tag}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Comment textarea */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            Feedback & Gratitude Note *
          </label>
          <textarea
            rows="3"
            required
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share details on food condition, temperature upon arrival, hygiene packing, and volunteer experience..."
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !comment.trim()}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{submitting ? 'Publishing Review...' : 'Publish Verified Review'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
