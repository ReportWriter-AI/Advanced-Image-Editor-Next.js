import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import User from '../../../../src/models/User';
import Company from '../../../../src/models/Company';
import crypto from 'crypto';
import { sendVerificationEmail } from '../../../../lib/email';
import { getCurrentUser } from '../../../../lib/auth-helpers';

// GET - List all team members
export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    // Get current user from token
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find all team members in the same company
    const teamMembers = await User.find({
      company: currentUser.company,
      isActive: true,
    })
      .select('-password -emailVerificationToken -resetPasswordToken -rememberMeToken')
      .sort({ createdAt: -1 });

    const company =
      currentUser.company
        ? await Company.findById(currentUser.company).select('createdBy')
        : null;

    const companyCreatorId = company?.createdBy ? String(company.createdBy) : null;

    // Separate inspectors and staff
    const inspectors = teamMembers.filter(member => member.role === 'inspector');
    const staff = teamMembers.filter(member => member.role === 'staff');

    return NextResponse.json({
      inspectors,
      staff,
      companyCreatorId,
    });

  } catch (error: any) {
    console.error('Get team error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}

// POST - Create a new team member
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    // Get current user from token
    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if current user has admin permissions
    if (!currentUser.is_company_admin) {
      return NextResponse.json(
        { error: 'You do not have permission to add team members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      email,
      phoneNumber,
      password,
      role,
      sendConfirmation,
      profileImageUrl,
      // Permissions
      can_schedule_self,
      can_schedule,
      can_publish,
      can_add_to_template,
      can_edit_template,
      can_manage_contacts,
      can_access_conversations,
      can_access_financial_data,
      is_company_admin,
      can_edit_inspections,
      can_delete_inspections,
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !role) {
      return NextResponse.json(
        { error: 'Please provide all required fields' },
        { status: 400 }
      );
    }

    // Validate role
    if (role !== 'inspector' && role !== 'staff') {
      return NextResponse.json(
        { error: 'Invalid role' },
        { status: 400 }
      );
    }

    // If sendConfirmation is false, password is required
    if (!sendConfirmation && !password) {
      return NextResponse.json(
        { error: 'Password is required when not sending confirmation' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    // Generate temporary password if sending confirmation
    let userPassword = password;
    let emailVerificationToken: string | undefined;
    let emailVerificationExpires: Date | undefined;
    let isEmailVerified = true;

    if (sendConfirmation) {
      // Generate random password
      userPassword = crypto.randomBytes(16).toString('hex');
      // Generate email verification token
      emailVerificationToken = crypto.randomBytes(32).toString('hex');
      emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      isEmailVerified = false;
    }

    const normalizedProfileImage =
      typeof profileImageUrl === 'string'
        ? profileImageUrl.trim() || null
        : undefined;

    // Create the user
    const newUser = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber: phoneNumber || undefined,
      profileImageUrl: normalizedProfileImage ?? undefined,
      password: userPassword,
      role,
      company: currentUser.company,
      createdBy: currentUser._id,
      isEmailVerified,
      emailVerificationToken,
      emailVerificationExpires,
      agreedToTerms: true, // Team members don't need to agree to terms separately
      smsOptIn: false,
      // Permissions
      can_schedule_self: can_schedule_self || false,
      can_schedule: can_schedule || false,
      can_publish: can_publish || false,
      can_add_to_template: can_add_to_template || false,
      can_edit_template: can_edit_template || false,
      can_manage_contacts: can_manage_contacts || false,
      can_access_conversations: can_access_conversations || false,
      can_access_financial_data: can_access_financial_data || false,
      is_company_admin: is_company_admin || false,
      can_edit_inspections: can_edit_inspections || false,
      can_delete_inspections: can_delete_inspections || false,
    });

    // Send verification email if requested
    if (sendConfirmation && emailVerificationToken) {
      await sendVerificationEmail(email, emailVerificationToken);
    }

    // Return the created user (without sensitive data)
    const userResponse = await User.findById(newUser._id).select(
      '-password -emailVerificationToken -resetPasswordToken -rememberMeToken'
    );

    return NextResponse.json(
      {
        message: sendConfirmation
          ? 'Team member created! Confirmation email sent.'
          : 'Team member created successfully!',
        user: userResponse,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Create team member error:', error);

    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create team member' },
      { status: 500 }
    );
  }
}

