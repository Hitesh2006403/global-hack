import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'delivery_tasks.json');

const getFutureISO = (hoursFromNow) => {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000).toISOString();
};

const SEED_TASKS = [
  {
    id: 'task-302',
    donationId: 'don-101',
    deliveryAgentId: 'user-delivery-1',
    foodName: 'Executive Buffet: Steamed Basmati Rice & Paneer Butter Masala',
    quantity: '35 servings (Partial claim)',
    foodType: 'cooked_meals',
    storageCondition: 'heated',
    urgencyLevel: 'HIGH',
    pickup: {
      location: 'Gate 3, Hyatt Regency Service Bay, MG Road',
      donorName: 'Chef Marco Rossi (Grand Hyatt)',
      donorPhone: '+91 98765 43210',
      deadline: getFutureISO(1.8),
    },
    dropoff: {
      location: '14 Sunshine Cross, Near St. Anne School',
      recipientName: 'Grace Hope Children Shelter',
      recipientPhone: '+91 91234 56789',
      recipientId: 'user-recipient-1',
      deadline: getFutureISO(2.3),
    },
    currentMilestone: 'READY_FOR_PICKUP',
    distanceTotalKm: 2.2,
    estimatedMinutes: 12,
    vehicleSuggestion: 'Hot box or two insulated delivery crates',
    safetyChecklistCompleted: false,
    verifiedAt: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-301',
    donationId: 'don-103',
    deliveryAgentId: 'user-delivery-1',
    foodName: 'Nutritious South Indian Meal: Sambar, Rice, Poriyal & Curd',
    quantity: '120 servings',
    foodType: 'cooked_meals',
    storageCondition: 'heated (Thermal Insulated)',
    urgencyLevel: 'URGENT',
    pickup: {
      location: 'Infosys Food Court 4, Dock B, Electronic City',
      donorName: 'Infosys Food Court 4',
      donorPhone: '+91 97711 22334',
      deadline: getFutureISO(1.5),
    },
    dropoff: {
      location: '14 Sunshine Cross, Near St. Anne School',
      recipientName: 'Grace Hope Children Shelter',
      recipientPhone: '+91 91234 56789',
      recipientId: 'user-recipient-1',
      deadline: getFutureISO(2.5),
    },
    currentMilestone: 'ASSIGNED',
    distanceTotalKm: 5.8,
    estimatedMinutes: 28,
    vehicleSuggestion: 'Thermal container insulated bag required',
    safetyChecklistCompleted: false,
    verifiedAt: null,
    createdAt: new Date().toISOString(),
  },
];

let tasks = [];

const loadTasks = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      tasks = JSON.parse(data);
    } else {
      tasks = [...SEED_TASKS];
      saveTasks();
    }
  } catch (err) {
    console.error('Error loading tasks store:', err);
    tasks = [...SEED_TASKS];
  }
};

const saveTasks = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving tasks store:', err);
  }
};

loadTasks();

export const deliveryTasksStore = {
  getAll: (filter = {}) => {
    let list = [...tasks];
    if (filter.agentId) {
      list = list.filter((t) => t.deliveryAgentId === filter.agentId);
    }
    if (filter.donationId) {
      list = list.filter((t) => t.donationId === filter.donationId);
    }
    return list;
  },

  findById: (id) => tasks.find((t) => t.id === id),

  findByDonationId: (donationId) => tasks.find((t) => t.donationId === donationId),

  create: (taskData) => {
    const id = `task-${Math.floor(400 + Math.random() * 600)}`;
    const newTask = {
      id,
      createdAt: new Date().toISOString(),
      currentMilestone: 'ASSIGNED',
      safetyChecklistCompleted: false,
      verifiedAt: null,
      ...taskData,
    };
    tasks.unshift(newTask);
    saveTasks();
    return newTask;
  },

  update: (id, updates) => {
    const index = tasks.findIndex((t) => t.id === id);
    if (index === -1) return null;
    tasks[index] = {
      ...tasks[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    saveTasks();
    return tasks[index];
  },

  updateMilestone: (id, milestone, meta = {}) => {
    const task = deliveryTasksStore.findById(id);
    if (!task) throw new Error(`Task ${id} not found`);

    return deliveryTasksStore.update(id, {
      currentMilestone: milestone,
      ...meta,
    });
  },

  reset: () => {
    tasks = [...SEED_TASKS];
    saveTasks();
    return tasks;
  },
};
