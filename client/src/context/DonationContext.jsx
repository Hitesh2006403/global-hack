import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useNotification } from './NotificationContext';
import confetti from 'canvas-confetti';

const DonationContext = createContext(null);

export const DonationProvider = ({ children }) => {
  const [donations, setDonations] = useState([]);
  const [requirements, setRequirements] = useState([]);
  const [deliveryTasks, setDeliveryTasks] = useState([]);
  const [impactMetrics, setImpactMetrics] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useNotification();

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [dons, reqs, tasks, metrics, revs] = await Promise.all([
        api.getDonations(),
        api.getRequirements(),
        api.getDeliveryTasks(),
        api.getImpactMetrics(),
        api.getReviews(),
      ]);
      setDonations(dons);
      setRequirements(reqs);
      setDeliveryTasks(tasks);
      setImpactMetrics(metrics);
      setReviews(revs || []);
    } catch (err) {
      console.error('Failed to load platform data:', err);
      addToast('Error loading platform records: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadData();

    // Real-time synchronization via Server-Sent Events
    const unsubscribe = api.subscribeHandoverStream((event) => {
      console.log('Real-time Handover Event:', event);
      loadData();
      if (event.type === 'PICKUP_CONFIRMED') {
        addToast(`Food Picked Up! In transit to shelter (${event.donationId})`, 'info');
      } else if (event.type === 'RECEIPT_CONFIRMED') {
        addToast(`Handover Completed! Food rescued successfully (${event.donationId})`, 'success');
        confetti({
          particleCount: 100,
          spread: 90,
          origin: { y: 0.6 },
          colors: ['#10B981', '#34D399', '#FBBF24'],
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [loadData, addToast]);

  // Create new surplus donation
  const createDonation = async (donationData) => {
    try {
      const created = await api.createDonation(donationData);
      setDonations((prev) => [created, ...prev]);
      addToast(`Surplus posted: "${created.foodName}" is now active!`, 'success');
      loadData();
      return created;
    } catch (err) {
      addToast('Failed to create donation: ' + err.message, 'error');
      throw err;
    }
  };

  // Reopen cancelled or remaining donation
  const reopenDonation = async (donationId, notes) => {
    try {
      const updated = await api.reopenDonation(donationId, notes);
      setDonations((prev) => prev.map((d) => (d.id === donationId ? updated : d)));
      addToast('Donation reopened & matched to surrounding community kitchens!', 'success');
      loadData();
      return updated;
    } catch (err) {
      addToast('Failed to reopen donation: ' + err.message, 'error');
      throw err;
    }
  };

  // Recipient submits requirement
  const postRequirement = async (reqData) => {
    try {
      const created = await api.postRequirement(reqData);
      setRequirements((prev) => [created, ...prev]);
      addToast('Requirement logged! Smart matching algorithm initiated.', 'success');
      loadData();
      return created;
    } catch (err) {
      addToast('Failed to post requirement: ' + err.message, 'error');
      throw err;
    }
  };

  // Recipient claims full or partial quantity
  const acceptDonation = async (claimData) => {
    try {
      const res = await api.acceptDonation(claimData);
      setDonations((prev) => prev.map((d) => (d.id === res.donation.id ? res.donation : d)));
      setDeliveryTasks((prev) => [res.task, ...prev]);

      // Confetti burst for successful rescue match!
      confetti({
        particleCount: 60,
        spread: 70,
        origin: { y: 0.65 },
        colors: ['#E11D48', '#F59E0B', '#10B981'],
      });

      addToast(
        `Claim registered! ${claimData.quantityAccepted} units allocated. Delivery dispatched.`,
        'success'
      );
      loadData();
      return res;
    } catch (err) {
      addToast('Claim failed: ' + err.message, 'error');
      throw err;
    }
  };

  // Delivery agent updates milestone
  const updateDeliveryMilestone = async (taskId, nextMilestone) => {
    try {
      const updated = await api.updateDeliveryMilestone(taskId, nextMilestone);
      setDeliveryTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      addToast(`Status updated: ${nextMilestone.replace(/_/g, ' ')}`, 'info');
      return updated;
    } catch (err) {
      addToast('Update failed: ' + err.message, 'error');
      throw err;
    }
  };

  // STAGE 1: Fetch or generate dynamic pickup QR code
  const getPickupToken = async (donationId) => {
    try {
      return await api.getPickupToken(donationId);
    } catch (err) {
      addToast('Failed to load pickup token: ' + err.message, 'error');
      throw err;
    }
  };

  // STAGE 2: Delivery agent scans donor's pickup QR code
  const verifyPickupScan = async ({ token, taskId, donationId, agentId }) => {
    try {
      return await api.verifyPickupScan({ token, taskId, donationId, agentId });
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // STAGE 2: Delivery agent confirms physical collection
  const confirmPickup = async ({ tokenId, token, taskId, safetyChecklist, agentId, notes }) => {
    try {
      const res = await api.confirmPickup({ tokenId, token, taskId, safetyChecklist, agentId, notes });
      confetti({
        particleCount: 80,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#8B5CF6', '#3B82F6', '#10B981'],
      });
      addToast('Food Picked Up! Delivery agent is en route to recipient shelter.', 'success');
      loadData();
      return res;
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // STAGE 2 / 3: Fetch receipt token for delivery agent to show to recipient
  const getReceiptToken = async (donationId) => {
    try {
      return await api.getReceiptToken(donationId);
    } catch (err) {
      addToast('Failed to load receipt token: ' + err.message, 'error');
      throw err;
    }
  };

  // STAGE 3: Recipient scans delivery agent's receipt QR code
  const verifyReceiptScan = async ({ token, recipientId }) => {
    try {
      return await api.verifyReceiptScan({ token, recipientId });
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // STAGE 3: Recipient confirms actual delivery
  const confirmReceipt = async ({
    tokenId,
    token,
    donationId,
    recipientId,
    recipientName,
    receivedQuantity,
    foodCondition,
    discrepancyNotes,
  }) => {
    try {
      const res = await api.confirmReceipt({
        tokenId,
        token,
        donationId,
        recipientId,
        recipientName,
        receivedQuantity,
        foodCondition,
        discrepancyNotes,
      });

      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.55 },
        colors: ['#10B981', '#F59E0B', '#E11D48'],
      });

      addToast('Handover Complete! Food rescued and distributed.', 'success');
      loadData();
      return res;
    } catch (err) {
      addToast(err.message, 'error');
      throw err;
    }
  };

  // Delivery agent verifies QR (backwards-compatible alias)
  const verifyHandover = async ({ taskId, qrToken, safetyChecklist }) => {
    return confirmPickup({
      token: qrToken,
      taskId,
      safetyChecklist,
      agentId: 'user-delivery-1',
    });
  };

  // Submit community review & feedback
  const submitReview = async (reviewData) => {
    try {
      const created = await api.submitReview(reviewData);
      setReviews((prev) => [created, ...prev]);

      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#F59E0B', '#E11D48', '#10B981'],
      });

      addToast('Review submitted! Thank you for strengthening community trust.', 'success');
      return created;
    } catch (err) {
      addToast('Failed to submit review: ' + err.message, 'error');
      throw err;
    }
  };

  return (
    <DonationContext.Provider
      value={{
        donations,
        requirements,
        deliveryTasks,
        impactMetrics,
        reviews,
        loading,
        refresh: loadData,
        createDonation,
        reopenDonation,
        postRequirement,
        acceptDonation,
        updateDeliveryMilestone,
        getPickupToken,
        verifyPickupScan,
        confirmPickup,
        getReceiptToken,
        verifyReceiptScan,
        confirmReceipt,
        verifyHandover,
        submitReview,
      }}
    >
      {children}
    </DonationContext.Provider>
  );
};

export const useDonations = () => {
  const context = useContext(DonationContext);
  if (!context) throw new Error('useDonations must be used within a DonationProvider');
  return context;
};
