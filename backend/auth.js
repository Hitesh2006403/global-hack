const crypto = require('node:crypto');

const TOKEN_SECRET = 'shareaplate_jwt_secret_token_secure_2026';

function createToken(user) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      email: user.email,
      fullName: user.full_name || user.fullName,
      organization: user.organization,
      role: user.role,
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 days
    })
  ).toString('base64url');

  const signature = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', TOKEN_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');

  if (signature !== expectedSig) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    return data;
  } catch {
    return null;
  }
}

function getUserFromRequest(req, db) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || !payload.id) return null;

  const user = db.prepare('SELECT id, full_name, email, organization, role, phone, address FROM users WHERE id = ?').get(payload.id);
  return user || null;
}

module.exports = {
  createToken,
  verifyToken,
  getUserFromRequest,
};
