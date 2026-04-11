import { Request, Response, NextFunction } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';

export type AppRole = Role;
export type Capability =
  | 'analytics:view'
  | 'media:manage'
  | 'reviews:moderate'
  | 'curation:manage';

const ROLE_CAPABILITIES: Record<AppRole, Capability[]> = {
  USER: [],
  ADMIN: ['analytics:view', 'media:manage', 'reviews:moderate', 'curation:manage'],
  MODERATOR: ['reviews:moderate'],
  CURATOR: ['media:manage', 'curation:manage'],
};

export interface AuthRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: {
    id: string;
    role: AppRole;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    res.status(401).json({ message: 'Access denied. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthRequest['user'];
    req.user = decoded;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid token.' });
  }
};

export const attachUserIfPresent = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.header('Authorization');
  const token = authHeader?.split(' ')[1];

  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as AuthRequest['user'];
    req.user = decoded;
  } catch (error) {
    req.user = undefined;
  }

  next();
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ message: 'Access denied. Admin privileges required.' });
  }
};

export const requireAnyRole = (roles: AppRole[]) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Access denied. No user found in token.' });
    return;
  }

  if (!roles.includes(req.user.role)) {
    res.status(403).json({ message: 'Access denied. Insufficient role permissions.' });
    return;
  }

  next();
};

export const requireCapability = (capability: Capability) => (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void => {
  if (!req.user) {
    res.status(401).json({ message: 'Access denied. No user found in token.' });
    return;
  }

  const capabilities = ROLE_CAPABILITIES[req.user.role] || [];

  if (!capabilities.includes(capability)) {
    res.status(403).json({ message: 'Access denied. Required capability is missing.' });
    return;
  }

  next();
};

export const getCapabilitiesForRole = (role: AppRole): Capability[] => ROLE_CAPABILITIES[role] || [];
