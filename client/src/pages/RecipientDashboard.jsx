import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { api } from '../services/api';
import { MatchCard } from '../components/recipient/MatchCard';
import { PostRequirementModal } from '../components/recipient/PostRequirementModal';
import { AcceptModal } from '../components/recipient/AcceptModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { RecipientQrScannerModal } from '../components/recipient/RecipientQrScannerModal';
import { ReviewsSection } from '../components/common/ReviewsSection';
import {
  Home,
  Sparkles,
  PlusCircle,
  Clock,
  MapPin,
  AlertCircle,
  CheckCircle2,
  QrCode,
  Scan,
  Search,
  X,
  Filter,
} from 'lucide-react';

export const RecipientDashboard = ({ isPostReqOpen, setIsPostReqOpen }) => {
  const { currentUser } = useAuth();
  const { donations, requirements } = useDonations();
  const [smartMatches, setSmartMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dietaryFilter, setDietaryFilter] = useState('ALL');
  const [selectedDonationForClaim, setSelectedDonationForClaim] = useState(null);
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);
  const [selectedDonationForScanner, setSelectedDonationForScanner] = useState(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const matches = await api.getSmartMatches(currentUser?.id || 'recipient-1');
        setSmartMatches(matches);
      } catch (e) {
        console.error(e);
      }
    };
    fetchMatches();
  }, [donations, currentUser]);

  // Recipient's claimed active handovers
  const claimedDonations = donations.filter((d) =>
    d.matchedRecipients?.some(
      (m) => m.recipientId === currentUser?.id || m.recipientName?.includes('Grace Hope')
    )
  );

  // Filter smart matches with search query & dietary category
  const filteredMatches = smartMatches.filter((m) => {
    const don = m.donation;
    const q = searchQuery.toLowerCase().trim();

    const matchesSearch =
      !q ||
      don.foodName.toLowerCase().includes(q) ||
      don.donorName.toLowerCase().includes(q) ||
      don.pickupLocation?.address.toLowerCase().includes(q) ||
      don.foodType.toLowerCase().includes(q);

    const matchesDiet =
      dietaryFilter === 'ALL' || don.dietaryCategory.toLowerCase() === dietaryFilter.toLowerCase();

    return matchesSearch && matchesDiet;
  });

  return (
    <div className="space-y-8">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-950 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-emerald-200">
            <Home className="w-3.5 h-3.5" />
            <span>Recipient Organization • {currentUser?.organizationName || 'Children Shelter'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Surplus Food Routing & Smart Matching
          </h2>
          <p className="text-sm text-emerald-100/90 leading-relaxed">
            Specify how many meals or food items your organization needs. Our proximity algorithm pairs you with verified restaurants and hotels before food quality degrades.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsPostReqOpen(true)}
              className="bg-white hover:bg-emerald-50 active:scale-95 text-emerald-900 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700" />
              <span>+ Post Food Requirement</span>
            </button>
            <span className="text-xs text-emerald-200 font-medium">
              ⚡ {smartMatches.length} smart matches available nearby right now
            </span>
          </div>
        </div>
      </div>

      {/* Active Claimed Deliveries in Progress */}
      {claimedDonations.length > 0 && (
        <div className="bg-white rounded-2xl border border-indigo-200 p-5 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 animate-ping" />
              <h4 className="font-bold text-sm text-slate-800">
                Your Active Claimed Donations (Awaiting Handover)
              </h4>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-700 font-semibold bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
                {claimedDonations.length} Active
              </span>
              <button
                onClick={() => setSelectedDonationForScanner(claimedDonations[0])}
                className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3 py-1.5 rounded-xl shadow-xs transition"
              >
                <Scan className="w-3.5 h-3.5" />
                <span>Scan Delivery QR</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {claimedDonations.map((don) => {
              const isReadyForReceiptScan = don.status === 'PICKED_UP';
              const isDelivered = don.status === 'DELIVERED' || don.status === 'COMPLETED';

              return (
                <div
                  key={don.id}
                  className={`border rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isReadyForReceiptScan
                      ? 'bg-purple-50/60 border-purple-200'
                      : isDelivered
                      ? 'bg-teal-50/60 border-teal-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-900 truncate">{don.foodName}</span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase ${
                        isDelivered
                          ? 'bg-teal-100 text-teal-800'
                          : isReadyForReceiptScan
                          ? 'bg-purple-100 text-purple-800 animate-pulse'
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {don.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      From {don.donorName} • Assigned Courier: Vikram Singh (Rider #42)
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {isReadyForReceiptScan ? (
                      <button
                        onClick={() => setSelectedDonationForScanner(don)}
                        className="flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-3.5 py-2 rounded-xl shadow-xs transition"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        <span>Scan Rider QR & Confirm</span>
                      </button>
                    ) : isDelivered ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-100 px-3 py-1.5 rounded-lg border border-teal-300">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Delivered ✓</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => setSelectedDonationForScanner(don)}
                        className="flex items-center gap-1 text-xs font-semibold bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg shadow-2xs transition"
                      >
                        <Scan className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Scan QR</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PROMINENT SEARCH BAR & DIETARY FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search available meals by food name, donor kitchen, or location..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="text-xs text-slate-500 font-medium shrink-0">
            {searchQuery ? (
              <span className="bg-emerald-50 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200">
                Found {filteredMatches.length} match(es)
              </span>
            ) : (
              <span>{filteredMatches.length} available smart matches</span>
            )}
          </div>
        </div>

        {/* Dietary Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
            Dietary:
          </span>
          {[
            { id: 'ALL', label: 'All Categories' },
            { id: 'veg', label: '🥦 Vegetarian' },
            { id: 'vegan', label: '🌱 100% Vegan' },
            { id: 'non_veg', label: '🍗 Non-Vegetarian' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setDietaryFilter(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                dietaryFilter === cat.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Smart Match Recommendations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <h3 className="text-lg font-bold text-slate-900">
              Smart-Match Recommendations
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Ranked by Proximity • Expiry Urgency • Safe Holding Time
          </span>
        </div>

        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto">
              <Home className="w-6 h-6" />
            </div>
            <h4 className="text-base font-bold text-slate-800">No surplus donations match your filter</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery
                ? `No batches matched "${searchQuery}". Try broadening your search or dietary filter.`
                : 'No active surplus donations currently available in this radius. Broadcast your food requirement above.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDietaryFilter('ALL');
                }}
                className="inline-flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
              >
                <span>Reset Search Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMatches.map((match) => (
              <MatchCard
                key={match.donation.id}
                match={match}
                onClaim={(don) => setSelectedDonationForClaim(don)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recipient Active Requirements Log */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span>Your Submitted Requirements</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {requirements.map((req) => (
            <div key={req.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">{req.foodType?.replace('_', ' ').toUpperCase()}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">
                  {req.urgency} URGENCY
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Quantity needed: <strong>{req.quantityNeeded} {req.unit}</strong> ({req.dietaryPreference})
              </p>
              <div className="text-[11px] text-slate-400">
                Deliver to: {req.location}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* REVIEWS & COMMUNITY FEEDBACK SECTION */}
      <div className="pt-4 border-t border-slate-200">
        <ReviewsSection />
      </div>

      {/* Modals */}
      <PostRequirementModal
        isOpen={isPostReqOpen}
        onClose={() => setIsPostReqOpen(false)}
      />

      <AcceptModal
        isOpen={!!selectedDonationForClaim}
        onClose={() => setSelectedDonationForClaim(null)}
        donation={selectedDonationForClaim}
      />

      <QrCodeModal
        isOpen={!!selectedDonationForQr}
        onClose={() => setSelectedDonationForQr(null)}
        donation={selectedDonationForQr}
      />

      <RecipientQrScannerModal
        isOpen={!!selectedDonationForScanner}
        onClose={() => setSelectedDonationForScanner(null)}
        targetDonation={selectedDonationForScanner}
      />
    </div>
  );
};
