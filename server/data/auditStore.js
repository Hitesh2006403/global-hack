import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, 'audit_log.json');

let logs = [];

const loadLogs = () => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, 'utf-8');
      logs = JSON.parse(data);
    } else {
      logs = [];
      saveLogs();
    }
  } catch (err) {
    console.error('Error loading audit log:', err);
    logs = [];
  }
};

const saveLogs = () => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(logs, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving audit log:', err);
  }
};

loadLogs();

export const auditStore = {
  record: ({ action, donationId, taskId, stage, userId, userRole, ip, success, reason, metadata = {} }) => {
    const entry = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      action,
      donationId: donationId || null,
      taskId: taskId || null,
      stage: stage || null,
      userId: userId || 'anonymous',
      userRole: userRole || 'guest',
      ip: ip || '127.0.0.1',
      success: Boolean(success),
      reason: reason || (success ? 'Operation authorized and verified' : 'Rejected'),
      metadata,
    };
    logs.unshift(entry);
    // Keep reasonable size
    if (logs.length > 500) logs.pop();
    saveLogs();
    return entry;
  },

  getAll: (filter = {}) => {
    let list = [...logs];
    if (filter.donationId) list = list.filter((l) => l.donationId === filter.donationId);
    if (filter.stage) list = list.filter((l) => l.stage === filter.stage);
    return list;
  },
};
