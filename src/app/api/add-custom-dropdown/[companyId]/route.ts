import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import Company from '@/src/models/Company';
import User from '@/src/models/User';
import ReusableDropdown from '@/src/models/ReusableDropdown';
import InspectionSection from '@/src/models/InspectionSection';
import ModifierField from '@/src/models/ModifierField';
import { ensureDefaultInspectionSectionsForCompany } from '@/lib/inspection-section-service';
import { ensureDefaultModifiersForCompany } from '@/lib/modifier-service';
import { SERVICE_CATEGORIES } from '@/constants/serviceCategories';

interface RouteParams {
  params: Promise<{
    companyId: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const { companyId } = await context.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(companyId)) {
      return NextResponse.json(
        { error: 'Invalid company ID format' },
        { status: 400 }
      );
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Verify the company exists
    const company = await Company.findById(companyObjectId);
    if (!company) {
      return NextResponse.json(
        { error: 'Company not found' },
        { status: 404 }
      );
    }

    // Resolve createdBy user
    let userId: mongoose.Types.ObjectId | null = null;
    
    if (company.createdBy) {
      userId = company.createdBy;
    } else {
      // Find first admin user from the company
      const adminUser = await User.findOne({
        company: companyObjectId,
        is_company_admin: true,
      });
      
      if (!adminUser) {
        return NextResponse.json(
          { error: 'No admin user found for this company. Cannot determine createdBy user.' },
          { status: 400 }
        );
      }
      //@ts-ignore
      userId = adminUser._id;
    }

    // Delete existing data
    await ReusableDropdown.deleteOne({ company: companyObjectId });
    await InspectionSection.deleteMany({ company: companyObjectId });
    await ModifierField.deleteMany({ company: companyObjectId });

    // Create new ReusableDropdown
    await ReusableDropdown.create({
      company: companyObjectId,
      createdBy: userId,
      foundation: 'Crawlspace, Slab, Grade',
      role: 'Buyer, Seller, Attorney',
      referralSources: 'Real Estate Agent, Previous Client, Friend/Family Member, Lender, Google Search, Social Media, Our Website, Google Ad',
      location: [],
      serviceCategory: SERVICE_CATEGORIES.join(", "),
    });

    // Create default inspection sections
    //@ts-ignore
    await ensureDefaultInspectionSectionsForCompany(companyObjectId);

    // Create default modifiers
    //@ts-ignore
    await ensureDefaultModifiersForCompany(companyObjectId, userId);

    return NextResponse.json(
      {
        message: 'Default dropdown and inspection section data added successfully',
        companyId: companyId,
      },
      { status: 201 }
    );

  } catch (error: any) {
    console.error('Add custom dropdown error:', error);
    
    return NextResponse.json(
      { error: error.message || 'Failed to add custom dropdown data' },
      { status: 500 }
    );
  }
}

