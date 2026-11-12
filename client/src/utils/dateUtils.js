// Date and expiry countdown utility functions

export const getTimeRemaining = (expiryDeadline, safetyBufferMinutes = 0) => {
  if (!expiryDeadline) return { totalMs: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true, isCritical: true };

  const deadline = new Date(expiryDeadline).getTime();
  const bufferMs = safetyBufferMinutes * 60 * 1000;
  // Effective safe deadline considers safety buffer
  const effectiveDeadline = deadline - bufferMs;
  const now = Date.now();
  const diffMs = effectiveDeadline - now;

  if (diffMs <= 0) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      isCritical: true,
      label: 'Expired',
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  const isCritical = diffMs < 60 * 60 * 1000; // < 1 hour
  const isExpiringSoon = diffMs < 3 * 60 * 60 * 1000; // < 3 hours

  let label = `${hours}h ${minutes}m left`;
  if (hours === 0) {
    label = `${minutes}m ${seconds}s left`;
  }

  return {
    totalMs: diffMs,
    hours,
    minutes,
    seconds,
    isExpired: false,
    isCritical,
    isExpiringSoon,
    label,
  };
};

export const formatDateTime = (isoString) => {
  if (!isoString) return 'N/A';
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

export const formatRelativeTime = (isoString) => {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
