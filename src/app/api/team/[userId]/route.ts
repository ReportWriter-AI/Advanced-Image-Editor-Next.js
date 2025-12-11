import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../../lib/db';
import User from '../../../../../src/models/User';
import Company from '../../../../../src/models/Company';
import Availability from '../../../../../src/models/Availability';
import { getCurrentUser } from '../../../../../lib/auth-helpers';

// PUT - Update a team member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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
        { error: 'You do not have permission to update team members' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      firstName,
      lastName,
      phoneNumber,
      profileImageUrl,
      signatureImageUrl,
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

    const normalizedProfileImage =
      typeof profileImageUrl === 'string'
        ? profileImageUrl.trim() || null
        : undefined;

    const normalizedSignatureImage =
      typeof signatureImageUrl === 'string'
        ? signatureImageUrl.trim() || null
        : undefined;

    const { userId } = await params;

    // Find the team member to update
    const teamMember = await User.findOne({
      _id: userId,
      company: currentUser.company,
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    // Update the team member
    const updatePayload: Record<string, any> = {
      firstName: firstName || teamMember.firstName,
      lastName: lastName || teamMember.lastName,
      phoneNumber: phoneNumber !== undefined ? phoneNumber : teamMember.phoneNumber,
      // Permissions
      can_schedule_self: can_schedule_self !== undefined ? can_schedule_self : teamMember.can_schedule_self,
      can_schedule: can_schedule !== undefined ? can_schedule : teamMember.can_schedule,
      can_publish: can_publish !== undefined ? can_publish : teamMember.can_publish,
      can_add_to_template: can_add_to_template !== undefined ? can_add_to_template : teamMember.can_add_to_template,
      can_edit_template: can_edit_template !== undefined ? can_edit_template : teamMember.can_edit_template,
      can_manage_contacts: can_manage_contacts !== undefined ? can_manage_contacts : teamMember.can_manage_contacts,
      can_access_conversations: can_access_conversations !== undefined ? can_access_conversations : teamMember.can_access_conversations,
      can_access_financial_data: can_access_financial_data !== undefined ? can_access_financial_data : teamMember.can_access_financial_data,
      is_company_admin: is_company_admin !== undefined ? is_company_admin : teamMember.is_company_admin,
      can_edit_inspections: can_edit_inspections !== undefined ? can_edit_inspections : teamMember.can_edit_inspections,
      can_delete_inspections: can_delete_inspections !== undefined ? can_delete_inspections : teamMember.can_delete_inspections,
    };

    if (normalizedProfileImage !== undefined) {
      updatePayload.profileImageUrl = normalizedProfileImage;
    }

    // Only update signature for inspectors
    if (teamMember.role === 'inspector' && normalizedSignatureImage !== undefined) {
      updatePayload.signatureImageUrl = normalizedSignatureImage;
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updatePayload,
      { new: true, runValidators: true }
    ).select('-password -emailVerificationToken -resetPasswordToken -rememberMeToken');

    return NextResponse.json({
      message: 'Team member updated successfully',
      user: updatedUser,
    });

  } catch (error: any) {
    console.error('Update team member error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update team member' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a team member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
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
        { error: 'You do not have permission to delete team members' },
        { status: 403 }
      );
    }

    const { userId } = await params;

    // Prevent user from deleting themselves
    if (String(currentUser._id) === userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    const company =
      currentUser.company
        ? await Company.findById(currentUser.company).select('createdBy')
        : null;

    if (company?.createdBy && String(company.createdBy) === userId) {
      return NextResponse.json(
        { error: 'You cannot delete the company owner' },
        { status: 400 }
      );
    }

    // Find the team member to delete
    const teamMember = await User.findOne({
      _id: userId,
      company: currentUser.company,
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: 'Team member not found' },
        { status: 404 }
      );
    }

    await Availability.deleteMany({
      inspector: teamMember._id,
      company: teamMember.company,
    });

    await teamMember.deleteOne();

    return NextResponse.json({
      message: 'Team member deleted successfully',
    });

  } catch (error: any) {
    console.error('Delete team member error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete team member' },
      { status: 500 }
    );
  }
}

