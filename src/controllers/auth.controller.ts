import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { Role } from '@prisma/client';
import prisma from '../prisma/client';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AuthRequest } from '../middlewares/auth.middleware';
import { serializeUser } from '../utils/serialize-user';
import { sendPasswordResetEmail } from '../utils/email';

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

type DemoRole = 'USER' | 'ADMIN' | 'MODERATOR' | 'CURATOR';

const DEMO_USERS: Record<DemoRole, { email: string; name: string; password: string; role: Role; favoriteGenres: string[] }> = {
  USER: {
    email: 'demo-user@cinetube.com',
    name: 'Demo Viewer',
    password: 'User123!',
    role: Role.USER,
    favoriteGenres: ['Action', 'Comedy', 'Sci-Fi'],
  },
  ADMIN: {
    email: 'demo-admin@cinetube.com',
    name: 'Demo Admin',
    password: 'Admin123!',
    role: Role.ADMIN,
    favoriteGenres: ['Drama', 'Thriller'],
  },
  MODERATOR: {
    email: 'demo-moderator@cinetube.com',
    name: 'Demo Moderator',
    password: 'Moderator123!',
    role: Role.MODERATOR,
    favoriteGenres: ['Crime', 'Mystery'],
  },
  CURATOR: {
    email: 'demo-curator@cinetube.com',
    name: 'Demo Curator',
    password: 'Curator123!',
    role: Role.CURATOR,
    favoriteGenres: ['Drama', 'Romance', 'Fantasy'],
  },
};

function signToken(user: { id: string; role: Role }) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET as string,
    { expiresIn: '1d' },
  );
}

function normalizeGenres(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function getClientUrl(req: Request): string {
  const configuredClientUrl = process.env.CLIENT_URL?.trim();

  if (configuredClientUrl) {
    return configuredClientUrl.replace(/\/$/, '');
  }

  const requestOrigin = req.headers.origin;

  if (typeof requestOrigin === 'string' && requestOrigin.trim()) {
    return requestOrigin.replace(/\/$/, '');
  }

  return 'http://localhost:3000';
}

export const registerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      res.status(400).json({ message: 'An account with this email already exists.' });
      return;
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user in database
    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: Role.USER,
      },
    });

    res.status(201).json({
      message: 'Account created successfully!',
      user: serializeUser(newUser),
    });
  } catch (error) {
    res.status(500).json({ message: 'Something went wrong on the server.' });
  }
};



export const loginUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found!' });
      return;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ message: 'Invalid credentials!' });
      return;
    }

    const token = signToken(user);

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { credential } = req.body; 


    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(400).json({ message: 'Invalid Google token' });
      return;
    }

    const { email, name } = payload;

 
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {

      const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          name: name || 'Google User',
          email,
          password: hashedPassword,
          role: Role.USER,
        },
      });
    }


    const token = signToken(user);

    res.status(200).json({
      message: 'Google login successful',
      token,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Google Login Error:', error);
    res.status(500).json({ message: 'Google login failed' });
  }
};

export const loginDemoUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const requestedRole = ['ADMIN', 'MODERATOR', 'CURATOR', 'USER'].includes(req.body?.role)
      ? req.body.role as DemoRole
      : 'USER';
    const demoConfig = DEMO_USERS[requestedRole];

    const existingUser = await prisma.user.findUnique({
      where: { email: demoConfig.email },
    });

    const hashedPassword = await bcrypt.hash(demoConfig.password, 10);
    let user = existingUser;

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: demoConfig.name,
          email: demoConfig.email,
          password: hashedPassword,
          role: demoConfig.role,
          favoriteGenres: demoConfig.favoriteGenres,
        },
      });
    } else if (
      user.role !== demoConfig.role ||
      user.name !== demoConfig.name
    ) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          name: demoConfig.name,
          role: demoConfig.role,
          password: hashedPassword,
          favoriteGenres: demoConfig.favoriteGenres,
        },
      });
    }

    res.status(200).json({
      message: `${demoConfig.role.charAt(0)}${demoConfig.role.slice(1).toLowerCase()} demo session ready.`,
      token: signToken(user),
      user: serializeUser(user),
      credentials: {
        email: demoConfig.email,
        password: demoConfig.password,
      },
    });
  } catch (error) {
    console.error('Demo Login Error:', error);
    res.status(500).json({ message: 'Failed to start a demo session.' });
  }
};

export const getCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Access denied. No user found in token.' });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: 'User not found.' });
      return;
    }

    res.status(200).json({ user: serializeUser(user) });
  } catch (error) {
    console.error('Get Current User Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateCurrentUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ message: 'Access denied. No user found in token.' });
      return;
    }

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const avatarUrl = typeof req.body.avatarUrl === 'string' ? req.body.avatarUrl.trim() : '';
    const favoriteGenres = normalizeGenres(req.body.favoriteGenres);
    const communicationOptIn = typeof req.body.communicationOptIn === 'boolean'
      ? req.body.communicationOptIn
      : true;

    if (!name) {
      res.status(400).json({ message: 'Name is required.' });
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        avatarUrl: avatarUrl || null,
        favoriteGenres,
        communicationOptIn,
      },
    });

    res.status(200).json({
      message: 'Profile updated successfully.',
      user: serializeUser(updatedUser),
    });
  } catch (error) {
    console.error('Update Current User Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const requestPasswordReset = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';

    if (!email) {
      res.status(400).json({ message: 'Email is required.' });
      return;
    }

    const genericMessage = 'If an account with that email exists, a reset link has been sent.';
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      res.status(200).json({ message: genericMessage });
      return;
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpiresAt = new Date(Date.now() + 1000 * 60 * 60);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: resetExpiresAt,
      },
    });

    const resetUrl = `${getClientUrl(req)}/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, user.name, resetUrl);
    } catch (mailError) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpires: null,
        },
      });

      console.error('Password reset email error:', mailError);
      res.status(500).json({ message: 'Could not send reset email right now.' });
      return;
    }

    res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error('Forgot Password Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = typeof req.body.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!token || !password) {
      res.status(400).json({ message: 'Token and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: 'Password must be at least 6 characters long.' });
      return;
    }

    const hashedResetToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: hashedResetToken,
        passwordResetExpires: { gt: new Date() },
      },
    });

    if (!user) {
      res.status(400).json({ message: 'This reset link is invalid or has expired.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    res.status(200).json({ message: 'Password reset successful. Please sign in.' });
  } catch (error) {
    console.error('Reset Password Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
