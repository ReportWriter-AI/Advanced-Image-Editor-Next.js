import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface JWTPayload {
  userId: string;
  email: string;
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}

/**
 * Extract and verify token from httpOnly cookie or Authorization header (fallback)
 */
export function authenticateRequest(request: NextRequest): JWTPayload | null {
  // First, try to get token from httpOnly cookie (preferred method)
  const cookieToken = request.cookies.get('authToken')?.value;
  
  if (cookieToken) {
    return verifyToken(cookieToken);
  }

  // Fallback to Authorization header for backwards compatibility or API calls
  const authHeader = request.headers.get('Authorization');
  
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    return verifyToken(token);
  }

  return null;
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: string, email: string, expiresIn: string = '24h'): string {
  return jwt.sign(
    { userId, email },
    JWT_SECRET,
    { expiresIn }
  );
}

