import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/auth-helpers';
import Company from '../../../../src/models/Company';

const sanitizeString = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

const buildUpdateOperations = (fields: Record<string, string | undefined>) => {
  const set: Record<string, string> = {};
  const unset: Record<string, 1> = {};

  Object.entries(fields).forEach(([key, value]) => {
    if (value === undefined) {
      unset[key] = 1;
    } else {
      set[key] = value;
    }
  });

  const update: Record<string, any> = {};
  if (Object.keys(set).length > 0) {
    update.$set = set;
  }
  if (Object.keys(unset).length > 0) {
    update.$unset = unset;
  }

  return update;
};

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let companyData = null;
    if (currentUser.company) {
      const company = await Company.findById(currentUser.company);
      if (company) {
        companyData = {
          id: company._id,
          name: company.name,
          address: company.address || '',
          country: company.country || '',
          state: company.state || '',
          city: company.city || '',
          zip: company.zip || '',
          displayAddressPublicly: company.displayAddressPublicly ?? false,
          phone: company.phone || '',
          website: company.website || '',
          email: company.email || '',
          description: company.description || '',
          videoUrl: company.videoUrl || '',
          serviceOffered: company.serviceOffered || '',
          serviceArea: company.serviceArea || '',
          logoUrl: company.logoUrl || '',
          headerLogoUrl: company.headerLogoUrl || '',
        };
      }
    }

    return NextResponse.json({
      user: {
        id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        phoneNumber: currentUser.phoneNumber || '',
        credentials: currentUser.credentials || '',
        email: currentUser.email,
        profileImageUrl: currentUser.profileImageUrl || '',
      },
      company: companyData,
    });
  } catch (error: any) {
    console.error('Profile GET error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to load profile data' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { company, inspector } = body ?? {};

    if (!company || !inspector) {
      return NextResponse.json(
        { error: 'Invalid payload: company and inspector data are required' },
        { status: 400 }
      );
    }

    if (!company.name || !inspector.firstName || !inspector.lastName) {
      return NextResponse.json(
        { error: 'Company name and inspector first/last name are required' },
        { status: 400 }
      );
    }

    const companyStrings = {
      address: sanitizeString(company.address),
      country: sanitizeString(company.country),
      state: sanitizeString(company.state),
      city: sanitizeString(company.city),
      zip: sanitizeString(company.zip),
      phone: sanitizeString(company.phone),
      website: sanitizeString(company.website),
      email: sanitizeString(company.email),
      videoUrl: sanitizeString(company.videoUrl),
      serviceOffered: sanitizeString(company.serviceOffered),
      serviceArea: sanitizeString(company.serviceArea),
      logoUrl: sanitizeString(company.logoUrl),
      headerLogoUrl: sanitizeString(company.headerLogoUrl),
    };

    const companyUpdate = buildUpdateOperations(companyStrings);

    if (!companyUpdate.$set) {
      companyUpdate.$set = {};
    }

    companyUpdate.$set.name = company.name.trim();
    companyUpdate.$set.displayAddressPublicly = Boolean(company.displayAddressPublicly);
    companyUpdate.$set.description = company.description ?? '';

    let updatedCompany = null;

    if (currentUser.company) {
      updatedCompany = await Company.findByIdAndUpdate(
        currentUser.company,
        companyUpdate,
        { new: true, runValidators: true }
      );
    }

    if (!updatedCompany) {
      const creationPayload: Record<string, any> = {
        name: company.name.trim(),
        displayAddressPublicly: Boolean(company.displayAddressPublicly),
        description: company.description ?? '',
        createdBy: currentUser._id,
      };

      Object.entries(companyStrings).forEach(([key, value]) => {
        if (value !== undefined) {
          creationPayload[key] = value;
        }
      });

      updatedCompany = await Company.create(creationPayload);
      currentUser.company = updatedCompany._id as typeof currentUser.company;
    }

    const sanitizedPhone = sanitizeString(inspector.phoneNumber);
    const sanitizedCredentials = sanitizeString(inspector.credentials);
    const sanitizedProfileImage = sanitizeString(inspector.profileImageUrl);

    currentUser.firstName = inspector.firstName.trim();
    currentUser.lastName = inspector.lastName.trim();
    currentUser.phoneNumber = sanitizedPhone ?? undefined;
    currentUser.credentials = sanitizedCredentials ?? undefined;

    if (sanitizedProfileImage === undefined) {
      currentUser.set('profileImageUrl', undefined);
    } else {
      currentUser.profileImageUrl = sanitizedProfileImage;
    }

    await currentUser.save();

    const responseCompany = {
      id: updatedCompany._id,
      name: updatedCompany.name,
      address: updatedCompany.address || '',
      country: updatedCompany.country || '',
      state: updatedCompany.state || '',
      city: updatedCompany.city || '',
      zip: updatedCompany.zip || '',
      displayAddressPublicly: updatedCompany.displayAddressPublicly ?? false,
      phone: updatedCompany.phone || '',
      website: updatedCompany.website || '',
      email: updatedCompany.email || '',
      description: updatedCompany.description || '',
      videoUrl: updatedCompany.videoUrl || '',
      serviceOffered: updatedCompany.serviceOffered || '',
      serviceArea: updatedCompany.serviceArea || '',
      logoUrl: updatedCompany.logoUrl || '',
      headerLogoUrl: updatedCompany.headerLogoUrl || '',
    };

    return NextResponse.json({
      message: 'Profile updated successfully',
      user: {
        id: currentUser._id,
        firstName: currentUser.firstName,
        lastName: currentUser.lastName,
        phoneNumber: currentUser.phoneNumber || '',
        credentials: currentUser.credentials || '',
        email: currentUser.email,
        profileImageUrl: currentUser.profileImageUrl || '',
      },
      company: responseCompany,
    });
  } catch (error: any) {
    console.error('Profile PUT error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile' },
      { status: 500 }
    );
  }
}
