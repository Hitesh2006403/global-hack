# Share A Plate — Frontend (MERN Client)

**Platform:** React 18+ (Vite) + Tailwind CSS v4 + Lucide Icons  
**Theme:** Professional Food-Rescue Warm Red & Amber Palette  
**Role:** Member 1 (Frontend & UI/UX Architecture)  
**Branch:** `feature/frontend-uiux`

---

## 🌟 Overview & Key Features

Share A Plate connects surplus food donors (restaurants, hotels, hostels, event caterers) with verified recipients (orphanages, shelters, community kitchens) before food expires.

### Implemented Modules & User Journeys:
1. **Donor Dashboard:**
   - Post surplus food with cooked timestamp, safe consumption duration, and safety buffer margin.
   - Food safety & hygiene declarations checklist.
   - Live Expiry Countdown timers with dynamic color coding (Green -> Amber -> Pulsing Red).
   - Quantity tracking with visual progress bar (Initial vs Claimed vs Remaining).
   - Instant "Handover QR" viewer.
   - One-click "Reopen & Rematch" for cancelled or leftover food.

2. **Recipient Dashboard:**
   - Post food requirements with urgency tiers (High, Medium, Standard) and dietary filters.
   - **Smart-Match Recommendations:** Shows match scores (e.g. 96%) with understandable algorithm reasons (proximity radius, hot meal compatibility, expiry urgency).
   - **Split Donation / Partial Acceptance:** Interactive allocation slider allowing shelters to claim only what they can consume (e.g. 35 out of 80 meals), leaving remainder active for other shelters.
   - Live claimed deliveries tracker with secure handover QR codes.

3. **Delivery Agent Interface:**
   - Real-time pickup & dropoff route cards with phone contact shortcuts.
   - Permitted milestone transitions (`ASSIGNED` ➔ `EN_ROUTE_PICKUP` ➔ `PICKED_UP` ➔ `DELIVERED`).
   - Thermal container / load advice for riders.
   - **QR Verification & Handover Inspection:** Requires matching QR token AND passing the mandatory 4-point physical food safety inspection before completing. Prevents premature completion.

4. **Admin & Operations Command:**
   - Environmental & social impact telemetry: Meals Rescued, CO₂ Prevented (kg), Average Time-to-Match, Rescue Success %.
   - High-priority alert banner for donations expiring within < 90 mins without claim.
   - Live searchable audit table with status filtering.

5. **Special Features:**
   - **Real-Time Urgency Ticker:** Marquee across top showing batches closest to expiry deadline.
   - **AI Voice-Call Dispatch Simulation:** Interactive modal demonstrating automated telephone alert calls to nearby shelters with synthesized speech transcript and one-click voice claim.
   - **Persona Quick Switcher:** Allows judges and teammates to test Donor, Recipient, Rider, and Admin views with a single click.
   - **Web Audio Chimes:** Harmonized audio alerts for new matches and urgent dispatches.

---

## 🔌 Teammate Integration Guide (Members 2, 3, 4)

### Toggle between Mock Data and Real Backend
The frontend is built to run standalone via mock data OR connect directly to Member 2's Express backend.

In `client/.env`:
```env
# Set to 'false' when Member 2's backend is running
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:5000/api
```

### Shared API Endpoints Contract
- `POST /api/auth/login` & `POST /api/auth/register`
- `GET /api/donations` & `POST /api/donations`
- `PATCH /api/donations/:id/reopen`
- `GET /api/recipient/matches?recipientId=:id`
- `POST /api/donations/:id/accept` (with `{ quantityAccepted, notes }`)
- `GET /api/delivery/tasks?agentId=:id`
- `PATCH /api/delivery/tasks/:id/status`
- `POST /api/handover/verify-qr` (with `{ taskId, qrToken, safetyChecklist }`)
- `GET /api/admin/metrics`

---

## 🚀 Running Locally

```bash
cd client
npm install
npm run dev
```

Server starts at: `http://localhost:5173/`
Production build: `npm run build`
