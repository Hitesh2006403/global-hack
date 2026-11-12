import express from 'express';
import { authController } from '../controllers/authController.js';

const router = express.Router();

router.post('/google', authController.googleAuth);
router.post('/login', authController.login);
router.post('/register', authController.register);
router.get('/me', authController.getMe);
router.post('/logout', authController.logout);

export default router;
