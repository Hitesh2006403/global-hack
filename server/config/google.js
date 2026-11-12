import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

export const googleClient = new OAuth2Client(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET
);

export const getGoogleClientId = () => GOOGLE_CLIENT_ID;
