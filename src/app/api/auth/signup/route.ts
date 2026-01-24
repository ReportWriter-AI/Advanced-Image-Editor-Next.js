import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import dbConnect from '../../../../../lib/db';
import User from '../../../../../src/models/User';
import Company from '../../../../../src/models/Company';
import ReusableDropdown from '../../../../../src/models/ReusableDropdown';
import { sendVerificationEmail } from '../../../../../lib/email';
import { ensureDefaultModifiersForCompany } from '../../../../../lib/modifier-service';
import { ensureDefaultInspectionSectionsForCompany } from '../../../../../lib/inspection-section-service';
import { SERVICE_CATEGORIES } from '../../../../../constants/serviceCategories';

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { 
      firstName, 
      lastName, 
      email, 
      phoneNumber, 
      password, 
      smsOptIn,
      numberOfInspectors,
      yearsOfExperience,
      howDidYouHearAboutUs,
      agreedToTerms
    } = body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return NextResponse.json(
        { error: 'Please provide all required fields' },
        { status: 400 }
      );
    }

    // Default company name
    const companyName = 'My Inspection Company';

    // Validate terms agreement
    if (!agreedToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the privacy policy and terms and conditions' },
        { status: 400 }
      );
    }

    // Validate numberOfInspectors if provided
    if (numberOfInspectors !== undefined && numberOfInspectors !== null) {
      if (numberOfInspectors < 1) {
        return NextResponse.json(
          { error: 'Number of inspectors must be at least 1' },
          { status: 400 }
        );
      }
    }

    // Validate yearsOfExperience if provided
    if (yearsOfExperience !== undefined && yearsOfExperience !== null) {
      if (yearsOfExperience < 0) {
        return NextResponse.json(
          { error: 'Years of experience cannot be negative' },
          { status: 400 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    // Generate email verification token
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');
    const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Step 1: Create the company
    const company = await Company.create({
      name: companyName,
      plan: 'free', // Default plan
    });

    // Step 2: Create the user with company reference
    const user = await User.create({
      firstName,
      lastName,
      email: email.toLowerCase(),
      phoneNumber: phoneNumber || undefined,
      password,
      smsOptIn: smsOptIn || false,
      isEmailVerified: false,
      numberOfInspectors: numberOfInspectors || undefined,
      yearsOfExperience: yearsOfExperience || undefined,
      howDidYouHearAboutUs: howDidYouHearAboutUs || undefined,
      agreedToTerms,
      emailVerificationToken,
      emailVerificationExpires,
      role: 'inspector', // Default role is inspector
      company: company._id,
      // Give new users full inspector permissions
      can_schedule_self: true,
      can_schedule: true,
      can_publish: true,
      can_add_to_template: true,
      can_edit_template: true,
      can_manage_contacts: true,
      can_access_conversations: true,
      can_access_financial_data: true,
      is_company_admin: true,
    });

    // Step 3: Track the company creator
    await Company.findByIdAndUpdate(company._id, {
      createdBy: user._id,
    });

    //@ts-ignore
    await ensureDefaultModifiersForCompany(company._id, user._id);

    // Ensure default inspection sections for the company
    //@ts-ignore
    // await ensureDefaultInspectionSectionsForCompany(company._id);

    await ReusableDropdown.create({
      company: company._id,
      createdBy: user._id,
      foundation: 'Crawlspace, Slab, Grade',
      role: 'Buyer, Seller, Attorney',
      referralSources: 'Real Estate Agent, Previous Client, Friend/Family Member, Lender, Google Search, Social Media, Our Website, Google Ad',
      location: [],
      serviceCategory: SERVICE_CATEGORIES.join(", "),
      defaultDefectColor: "#FF8C00",
      defaultAnnotationTool: "arrow",
    });

    await sendVerificationEmail(email, emailVerificationToken);

    return NextResponse.json(
      {
        message: 'Account created successfully! Please check your email to verify your account.',
        userId: user._id,
        companyId: company._id,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Signup error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create account' },
      { status: 500 }
    );
  }
}

