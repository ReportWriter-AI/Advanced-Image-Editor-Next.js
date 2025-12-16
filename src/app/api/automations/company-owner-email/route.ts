import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Company from '@/src/models/Company';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'No company associated with current user' },
        { status: 400 }
      );
    }

    const company = await Company.findById(currentUser.company)
      .populate('createdBy', 'email')
      .lean();

    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    const ownerEmail = company.createdBy && typeof company.createdBy === 'object' 
      ? (company.createdBy as any).email 
      : null;

    // Also check if company has an email field
    const companyEmail = company.email || null;

    // Return company email if available, otherwise owner email
    const email = companyEmail || ownerEmail;

    return NextResponse.json({ email });
  } catch (error: any) {
    console.error('Get company owner email error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch company owner email' },
      { status: 500 }
    );
  }
}

