import express from 'express';
import { registerUser, loginUser, googleLogin, getCurrentUser } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = express.Router();

// Signup or registration route
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
router.get('/me', authenticate, getCurrentUser);
export default router;
