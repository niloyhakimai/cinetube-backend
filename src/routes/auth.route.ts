import express from 'express';
import { registerUser, loginUser, googleLogin } from '../controllers/auth.controller';

const router = express.Router();

// Signup or registration route
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/google', googleLogin);
export default router;