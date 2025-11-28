import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Client from '@/src/models/Client';
import { getOrCreateCategories } from '@/lib/category-utils';
import mongoose from 'mongoose';

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ 
        clients: [],
        pagination: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        }
      });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const categoriesParam = searchParams.get('categories');
    const categoryIds = categoriesParam ? categoriesParam.split(',').filter(Boolean) : [];
    const skip = (page - 1) * limit;

    // Build query
    const query: any = { company: currentUser.company };

    // Add search filter (name search)
    if (search.trim()) {
      query.$or = [
        { firstName: { $regex: search.trim(), $options: 'i' } },
        { lastName: { $regex: search.trim(), $options: 'i' } },
        { companyName: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Add categories filter (OR condition - client must have any of the selected categories)
    if (categoryIds.length > 0) {
      query.categories = { $in: categoryIds };
    }

    const total = await Client.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const clients = await Client.find(query)
      .populate('categories', 'name color')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    return NextResponse.json({ 
      clients,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
  } catch (error: any) {
    console.error('Get clients error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch clients' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 });
    }

    const body = await request.json();
    const {
      isCompany,
      firstName,
      lastName,
      companyName,
      email,
      ccEmail,
      phone,
      homePhone,
      mobilePhone,
      categories,
      internalNotes,
      internalAdminNotes,
      excludeFromMassEmail,
      unsubscribedFromMassEmails,
    } = body;

    // Validate required fields based on isCompany
    if (isCompany) {
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return NextResponse.json({ error: 'Company/Organization name is required' }, { status: 400 });
      }
    } else {
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
      }
    }

    // Validate email format if provided
    if (email && typeof email === 'string' && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Validate CC email format if provided
    if (ccEmail && typeof ccEmail === 'string' && ccEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(ccEmail.trim())) {
        return NextResponse.json({ error: 'Invalid CC email format' }, { status: 400 });
      }
    }

    // Process categories: accept both strings (names) and ObjectIds (backward compatibility)
    const categoryIds = await getOrCreateCategories(
      Array.isArray(categories) ? categories : [],
      currentUser.company,
      currentUser._id
    );

    const client = await Client.create({
      isCompany: Boolean(isCompany),
      firstName: isCompany ? undefined : firstName?.trim(),
      lastName: isCompany ? undefined : lastName?.trim(),
      companyName: isCompany ? companyName.trim() : undefined,
      email: email?.trim() || undefined,
      ccEmail: ccEmail?.trim() || undefined,
      phone: phone?.trim() || undefined,
      homePhone: homePhone?.trim() || undefined,
      mobilePhone: mobilePhone?.trim() || undefined,
      categories: categoryIds,
      internalNotes: internalNotes?.trim() || undefined,
      internalAdminNotes: internalAdminNotes?.trim() || undefined,
      excludeFromMassEmail: Boolean(excludeFromMassEmail ?? false),
      unsubscribedFromMassEmails: Boolean(unsubscribedFromMassEmails ?? false),
      company: currentUser.company,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    const populatedClient = await Client.findById(client._id)
      .populate('categories', 'name color')
      .lean();

    return NextResponse.json(
      { message: 'Client created successfully', client: populatedClient },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create client error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create client' },
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

    if (!currentUser.company) {
      return NextResponse.json({ error: 'No company associated with user' }, { status: 400 });
    }

    const body = await request.json();
    const {
      _id,
      isCompany,
      firstName,
      lastName,
      companyName,
      email,
      ccEmail,
      phone,
      homePhone,
      mobilePhone,
      categories,
      internalNotes,
      internalAdminNotes,
      excludeFromMassEmail,
      unsubscribedFromMassEmails,
    } = body;

    if (!_id) {
      return NextResponse.json({ error: 'Client ID is required' }, { status: 400 });
    }

    // Validate required fields based on isCompany
    if (isCompany) {
      if (!companyName || typeof companyName !== 'string' || !companyName.trim()) {
        return NextResponse.json({ error: 'Company/Organization name is required' }, { status: 400 });
      }
    } else {
      if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
        return NextResponse.json({ error: 'First name is required' }, { status: 400 });
      }
      if (!lastName || typeof lastName !== 'string' || !lastName.trim()) {
        return NextResponse.json({ error: 'Last name is required' }, { status: 400 });
      }
    }

    // Validate email format if provided
    if (email && typeof email === 'string' && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
      }
    }

    // Validate CC email format if provided
    if (ccEmail && typeof ccEmail === 'string' && ccEmail.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(ccEmail.trim())) {
        return NextResponse.json({ error: 'Invalid CC email format' }, { status: 400 });
      }
    }

    // Process categories: accept both strings (names) and ObjectIds (backward compatibility)
    const categoryIds = await getOrCreateCategories(
      Array.isArray(categories) ? categories : [],
      currentUser.company,
      currentUser._id
    );

    const client = await Client.findOneAndUpdate(
      { _id, company: currentUser.company },
      {
        isCompany: Boolean(isCompany),
        firstName: isCompany ? undefined : firstName?.trim(),
        lastName: isCompany ? undefined : lastName?.trim(),
        companyName: isCompany ? companyName.trim() : undefined,
        email: email?.trim() || undefined,
        ccEmail: ccEmail?.trim() || undefined,
        phone: phone?.trim() || undefined,
        homePhone: homePhone?.trim() || undefined,
        mobilePhone: mobilePhone?.trim() || undefined,
        categories: categoryIds,
        internalNotes: internalNotes?.trim() || undefined,
        internalAdminNotes: internalAdminNotes?.trim() || undefined,
        excludeFromMassEmail: Boolean(excludeFromMassEmail ?? false),
        unsubscribedFromMassEmails: Boolean(unsubscribedFromMassEmails ?? false),
        updatedBy: currentUser._id,
      },
      { new: true }
    ).populate('categories', 'name color');

    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json(
      { message: 'Client updated successfully', client: client.toObject() }
    );
  } catch (error: any) {
    console.error('Update client error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update client' },
      { status: 500 }
    );
  }
}

