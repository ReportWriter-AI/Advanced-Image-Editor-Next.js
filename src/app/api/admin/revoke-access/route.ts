import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import User from '../../../../../src/models/User';
import { authenticateRequest } from '../../../../../lib/auth';

/**
 * Revoke or restore user access
 * Only admins can use this endpoint
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Authenticate the request
    const currentUser = authenticateRequest(request);

    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get current user details to check if they're admin
    const admin = await User.findById(currentUser.userId);
    
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userId, revoke } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find the user to revoke/restore
    const user = await User.findById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent admin from revoking their own access
    if (user._id.toString() === currentUser.userId) {
      return NextResponse.json(
        { error: 'Cannot revoke your own access' },
        { status: 400 }
      );
    }

    // Update user's active status
    user.isActive = !revoke; // If revoke=true, set isActive=false
    await user.save();

    return NextResponse.json(
      {
        message: revoke 
          ? `Access revoked for ${user.email}. They will be logged out on their next request.`
          : `Access restored for ${user.email}`,
        user: {
          id: user._id,
          email: user.email,
          isActive: user.isActive,
        },
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Revoke access error:', error);
    return NextResponse.json(
      { error: 'Failed to update user access' },
      { status: 500 }
    );
  }
}

