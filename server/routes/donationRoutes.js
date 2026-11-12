import express from 'express';
import { donationsStore } from '../data/donationsStore.js';
import { deliveryTasksStore } from '../data/deliveryTasksStore.js';
import { handoverStore } from '../data/handoverStore.js';
import { broadcastHandoverEvent } from '../controllers/handoverController.js';

const router = express.Router();

// GET all donations with optional filters
router.get('/donations', (req, res) => {
  const { status, donorId } = req.query;
  const list = donationsStore.getAll({ status, donorId });
  res.json(list);
});

// GET single donation
router.get('/donations/:id', (req, res) => {
  const donation = donationsStore.findById(req.params.id);
  if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });
  res.json(donation);
});

// POST create new surplus donation
router.post('/donations', (req, res) => {
  try {
    const created = donationsStore.create(req.body);
    // Automatically generate initial pickup token
    const tokenRecord = handoverStore.createPickupToken({
      donationId: created.id,
      donorId: created.donorId,
      assignedAgentId: null,
      recipientId: null,
    });
    created.handoverQrToken = tokenRecord.rawToken;
    broadcastHandoverEvent({
      type: 'DONATION_CREATED',
      donationId: created.id,
      foodName: created.foodName,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PATCH reopen donation
router.patch('/donations/:id/reopen', (req, res) => {
  try {
    const updated = donationsStore.updateStatus(req.params.id, 'REOPENED', {
      reopenedAt: new Date().toISOString(),
      reopenNotes: req.body.notes || 'Reopened for community kitchens',
    });
    broadcastHandoverEvent({ type: 'DONATION_REOPENED', donationId: req.params.id });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST claim / accept donation
router.post('/donations/:id/accept', (req, res) => {
  try {
    const donation = donationsStore.findById(req.params.id);
    if (!donation) return res.status(404).json({ success: false, message: 'Donation not found' });

    const qty = Number(req.body.quantityAccepted);
    if (qty <= 0 || qty > donation.remainingQuantity) {
      return res.status(400).json({
        success: false,
        message: `Quantity must be between 1 and ${donation.remainingQuantity}`,
      });
    }

    donation.remainingQuantity -= qty;
    const nextStatus = donation.remainingQuantity === 0 ? 'ASSIGNED' : 'PARTIALLY_ACCEPTED';
    donation.status = nextStatus;

    if (!donation.matchedRecipients) donation.matchedRecipients = [];
    donation.matchedRecipients.push({
      recipientId: req.body.recipientId || 'user-recipient-1',
      recipientName: req.body.recipientName || 'Grace Hope Children Shelter',
      claimedQuantity: qty,
      claimedAt: new Date().toISOString(),
      notes: req.body.notes || '',
    });

    donationsStore.update(donation.id, donation);

    // Create delivery task
    const task = deliveryTasksStore.create({
      donationId: donation.id,
      deliveryAgentId: 'user-delivery-1',
      foodName: donation.foodName,
      quantity: `${qty} ${donation.unit}`,
      foodType: donation.foodType,
      storageCondition: donation.storageCondition,
      urgencyLevel: 'HIGH',
      pickup: {
        location: donation.pickupLocation?.address || 'Donor Location',
        donorName: donation.donorName,
        donorPhone: donation.donorPhone || '+91 98765 43210',
        deadline: donation.expiryDeadline,
      },
      dropoff: {
        location: '14 Sunshine Cross, Near St. Anne School',
        recipientName: req.body.recipientName || 'Grace Hope Children Shelter',
        recipientPhone: '+91 91234 56789',
        recipientId: req.body.recipientId || 'user-recipient-1',
        deadline: donation.expiryDeadline,
      },
      currentMilestone: 'ASSIGNED',
      distanceTotalKm: 3.2,
      estimatedMinutes: 20,
    });

    // Create / bind pickup token
    const tokenRecord = handoverStore.createPickupToken({
      donationId: donation.id,
      taskId: task.id,
      donorId: donation.donorId,
      assignedAgentId: 'user-delivery-1',
      recipientId: req.body.recipientId || 'user-recipient-1',
    });

    broadcastHandoverEvent({
      type: 'DONATION_ACCEPTED',
      donationId: donation.id,
      taskId: task.id,
      status: nextStatus,
    });

    res.json({ donation, task, token: tokenRecord.rawToken });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET delivery tasks
router.get('/delivery/tasks', (req, res) => {
  const { agentId } = req.query;
  const tasks = deliveryTasksStore.getAll({ agentId });
  res.json(tasks);
});

// PATCH delivery milestone
router.patch('/delivery/tasks/:id/status', (req, res) => {
  try {
    const task = deliveryTasksStore.findById(req.params.id);
    if (!task) return res.status(404).json({ success: false, message: 'Task not found' });

    const updated = deliveryTasksStore.updateMilestone(req.params.id, req.body.status);
    broadcastHandoverEvent({
      type: 'TASK_MILESTONE_UPDATED',
      taskId: task.id,
      milestone: req.body.status,
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET admin impact metrics
router.get('/admin/metrics', (req, res) => {
  const allDonations = donationsStore.getAll();
  const allTasks = deliveryTasksStore.getAll();
  const completed = allTasks.filter((t) => t.currentMilestone === 'DELIVERED').length;

  res.json({
    totalMealsRescued: 4892 + completed * 35,
    totalCo2PreventedKg: 9784 + completed * 70,
    activeDonationsCount: allDonations.filter((d) => d.status === 'AVAILABLE' || d.status === 'READY_FOR_PICKUP').length,
    completedDeliveriesCount: 384 + completed,
    averageTimeToMatchMinutes: 14.5,
    rescueSuccessPercentage: 97.4,
    activeVolunteersAndRiders: 24,
    partnerOrgsCount: 42,
  });
});

export default router;
