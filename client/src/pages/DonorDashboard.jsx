import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDonations } from '../context/DonationContext';
import { DonationCard } from '../components/donor/DonationCard';
import { CreateDonationModal } from '../components/donor/CreateDonationModal';
import { ReopenModal } from '../components/donor/ReopenModal';
import { QrCodeModal } from '../components/common/QrCodeModal';
import { ReviewsSection } from '../components/common/ReviewsSection';
import {
  UtensilsCrossed,
  PlusCircle,
  Filter,
  Sparkles,
  HeartHandshake,
  CheckCircle2,
  Clock,
  Search,
  X,
  Star,
} from 'lucide-react';

export const DonorDashboard = ({ isCreateOpen, setIsCreateOpen }) => {
  const { currentUser } = useAuth();
  const { donations, loading } = useDonations();
  const [activeTab, setActiveTab] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDonationForQr, setSelectedDonationForQr] = useState(null);
  const [selectedDonationForReopen, setSelectedDonationForReopen] = useState(null);

  // Filter donations relevant to this donor with search query
  const donorDonations = donations;

  const filtered = donorDonations.filter((d) => {
    // Venue / Category filter: HOTELS, Resturant, Event venue, Others
    let matchesTab = true;
    const venueText = `${d.donorName || ''} ${d.foodName || ''} ${d.pickupLocation?.address || ''}`.toLowerCase();

    if (activeTab === 'HOTELS') {
      matchesTab =
        d.venueType === 'HOTELS' ||
        /hotel|hyatt|sheraton|marriott|taj|resort|radisson|hilton/i.test(venueText);
    } else if (activeTab === 'Resturant') {
      matchesTab =
        d.venueType === 'Resturant' ||
        /restaurant|resturant|bistro|bakery|cafe|kitchen|diner|grill/i.test(venueText);
    } else if (activeTab === 'Event venue') {
      matchesTab =
        d.venueType === 'Event venue' ||
        /event|venue|banquet|catering|hall|convention|wedding|pavilion|grounds/i.test(venueText);
    } else if (activeTab === 'Others') {
      matchesTab =
        d.venueType === 'Others' ||
        /court|campus|hostel|mess|supermarket|market/i.test(venueText) ||
        (!/hotel|hyatt|sheraton/i.test(venueText) &&
          !/restaurant|bistro|bakery|grill/i.test(venueText) &&
          !/convention|wedding|pavilion/i.test(venueText));
    }

    // Search query filter
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      d.foodName.toLowerCase().includes(q) ||
      d.donorName.toLowerCase().includes(q) ||
      (d.dietaryCategory && d.dietaryCategory.toLowerCase().includes(q)) ||
      (d.pickupLocation?.address && d.pickupLocation.address.toLowerCase().includes(q));

    return matchesTab && matchesSearch;
  });

  const activeCount = donorDonations.filter(
    (d) => d.status === 'AVAILABLE' || d.status === 'PARTIALLY_ACCEPTED' || d.status === 'REOPENED'
  ).length;

  return (
    <div className="space-y-8">
      {/* Top Hero Banner */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-amber-900 rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden shadow-lg">
        <div className="relative z-10 max-w-2xl space-y-3">
          <div className="inline-flex items-center gap-1.5 bg-white/15 px-3 py-1 rounded-full text-xs font-semibold text-amber-200">
            <UtensilsCrossed className="w-3.5 h-3.5" />
            <span>Donor Hub • {currentUser?.organizationName || 'Kitchen Operations'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Rescue Surplus Food Before It Expires
          </h2>
          <p className="text-sm text-rose-100/90 leading-relaxed">
            Every minute counts. Post excess buffet meals, bakery goods, and groceries with live expiry countdowns. Our smart-match engine immediately routes food to local shelters.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setIsCreateOpen(true)}
              className="bg-white hover:bg-amber-50 active:scale-95 text-rose-800 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-md transition flex items-center gap-2"
            >
              <PlusCircle className="w-4 h-4 text-rose-600" />
              <span>Post Food Surplus Now</span>
            </button>
            <span className="text-xs text-rose-200 font-medium">
              ⚡ {activeCount} active batch(es) currently rescue-ready
            </span>
          </div>
        </div>

        {/* Ambient Decorative Shapes */}
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/20 to-transparent pointer-events-none" />
      </div>

      {/* PROMINENT SEARCH BAR & FILTERS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Real-time Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search donations by food name, location, dietary category..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-slate-200 bg-slate-50/60 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
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
              <span className="bg-rose-50 text-rose-700 font-bold px-2.5 py-1 rounded-lg border border-rose-200">
                Found {filtered.length} match(es)
              </span>
            ) : (
              <span>Showing {filtered.length} total batch(es)</span>
            )}
          </div>
        </div>

        {/* Category Tabs: HOTELS, Resturant, Event venue, Others */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full border-t border-slate-100 pt-3">
          {[
            { id: 'ALL', label: 'All Batches' },
            { id: 'HOTELS', label: 'HOTELS' },
            { id: 'Resturant', label: 'Resturant' },
            { id: 'Event venue', label: 'Event venue' },
            { id: 'Others', label: 'Others' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(activeTab === tab.id && tab.id !== 'ALL' ? 'ALL' : tab.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Donation Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center mx-auto">
            <UtensilsCrossed className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-slate-800">No donations found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery
              ? `No surplus food matched "${searchQuery}". Try clearing the search query.`
              : 'Post surplus food items to connect directly with orphanages and community kitchens.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-700 transition"
            >
              <span>Clear Search Query</span>
            </button>
          ) : (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center gap-1.5 bg-rose-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-500 transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Create First Surplus Post</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((donation) => (
            <DonationCard
              key={donation.id}
              donation={donation}
              onShowQr={(don) => setSelectedDonationForQr(don)}
              onReopen={(don) => setSelectedDonationForReopen(don)}
            />
          ))}
        </div>
      )}

      {/* REVIEWS & COMMUNITY FEEDBACK SECTION */}
      <div className="pt-4">
        <ReviewsSection />
      </div>

      {/* Modals */}
      <CreateDonationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

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
