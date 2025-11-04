import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import User from '../src/models/User';
import dbConnect from './db';
import { getToken } from './cookies';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Verify JWT token and get user ID
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Get current authenticated user from request
 */
export async function getCurrentUser(request: NextRequest) {
  try {
    await dbConnect();

    const token = getToken(request);
    if (!token) {
      return null;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return null;
    }

    const user = await User.findById(decoded.userId).select('-password');
    if (!user || !user.isActive) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get current user error:', error);
    return null;
  }
}

