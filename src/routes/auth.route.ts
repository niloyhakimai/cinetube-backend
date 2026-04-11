import express from 'express';
import {
  registerUser,
  loginUser,
  googleLogin,
  getCurrentUser,
  loginDemoUser,
  requestPasswordReset,
  resetPassword,
  updateCurrentUser,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Signup or registration route
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/demo-login', loginDemoUser);
router.post('/google', googleLogin);
router.post('/forgot-password', requestPasswordReset);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, getCurrentUser);
router.patch('/me', authenticate, updateCurrentUser);
export default router;
