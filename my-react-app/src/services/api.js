// Central API Client for Share A Plate Production Platform

const BASE_URL = ''; // Relative to origin (proxied / handled via Vite middleware)

function getToken() {
  return localStorage.getItem('shareaplate_token') || '';
}

function setToken(token) {
  if (token) {
    localStorage.setItem('shareaplate_token', token);
  } else {
    localStorage.removeItem('shareaplate_token');
  }
}

function getCurrentUser() {
  try {
    const raw = localStorage.getItem('shareaplate_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem('shareaplate_user', JSON.stringify(user));
  } else {
    localStorage.removeItem('shareaplate_user');
  }
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    const err = new Error(errorMsg);
    err.status = res.status;
    err.details = data.details;
    throw err;
  }

  return data;
}

export const api = {
  // Auth
  login: async (email, password, role) => {
    const data = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, role }),
    });
    setToken(data.token);
    setCurrentUser(data.user);
    return data;
  },

  register: async (userData) => {
    const data = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    setToken(data.token);
    setCurrentUser(data.user);
    return data;
  },

  logout: () => {
    setToken(null);
    setCurrentUser(null);
  },

  getMe: async () => {
    return request('/api/auth/me');
  },

  // Categories
  getCategories: async () => {
    return request('/api/categories');
  },

  // Donations
  getDonations: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return request(`/api/donations?${params.toString()}`);
  },

  getMyDonations: async () => {
    return request('/api/donations/donor/my');
  },

  getDonationHistory: async () => {
    return request('/api/donations/history');
  },

  getDonation: async (id) => {
    return request(`/api/donations/${id}`);
  },

  createDonation: async (donationData) => {
    return request('/api/donations', {
      method: 'POST',
      body: JSON.stringify(donationData),
    });
  },

  updateDonation: async (id, donationData) => {
    return request(`/api/donations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(donationData),
    });
  },

  cancelDonation: async (id) => {
    return request(`/api/donations/${id}`, {
      method: 'DELETE',
    });
  },

  // Requirements
  getRequirements: async (filters = {}) => {
    const params = new URLSearchParams(filters);
    return request(`/api/requirements?${params.toString()}`);
  },

  getMyRequirements: async () => {
    return request('/api/requirements/recipient/my');
  },

  createRequirement: async (reqData) => {
    return request('/api/requirements', {
      method: 'POST',
      body: JSON.stringify(reqData),
    });
  },

  // Intelligent Matching
  getMatchesForRequirement: async (requirementId) => {
    return request(`/api/matching/requirement/${requirementId}`);
  },

  getMatchesForDonation: async (donationId) => {
    return request(`/api/matching/donation/${donationId}`);
  },

  // Acceptance & Pickup
  acceptDonation: async (donationId, payload) => {
    return request(`/api/donations/${donationId}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getPickups: async () => {
    return request('/api/pickups');
  },

  updatePickupStatus: async (pickupId, newStatus, notes = '') => {
    return request(`/api/pickups/${pickupId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ newStatus, notes }),
    });
  },

  // Notifications
  getNotifications: async () => {
    return request('/api/notifications');
  },

  markNotificationRead: async (id) => {
    return request(`/api/notifications/${id}/read`, {
      method: 'PUT',
    });
  },

  markAllNotificationsRead: async () => {
    return request('/api/notifications/read-all', {
      method: 'PUT',
    });
  },

  // Dashboard Stats
  getDashboardStats: async () => {
    return request('/api/dashboard/stats');
  },

  // Helpers
  getToken,
  getCurrentUser,
};
