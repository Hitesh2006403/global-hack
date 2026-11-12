const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
);

const getGoogleClientId = () => GOOGLE_CLIENT_ID;

module.exports = {
  googleClient,
  getGoogleClientId,
};
