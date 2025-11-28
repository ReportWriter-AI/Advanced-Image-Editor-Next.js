import { NextRequest, NextResponse } from 'next/server';

import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Agent from '@/src/models/Agent';
import AgentTeam from '@/src/models/AgentTeam';
import '@/src/models/Agency';
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
        agents: [],
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
        { email: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // Add categories filter (OR condition - agent must have any of the selected categories)
    if (categoryIds.length > 0) {
      query.categories = { $in: categoryIds };
    }

    const total = await Agent.countDocuments(query);
    const totalPages = Math.ceil(total / limit);

    const agents = await Agent.find(query)
      .populate('categories', 'name color')
      .populate('agency', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Find which team each agent belongs to by querying AgentTeam
    const agentIds = agents.map((a: any) => a._id);
    const teamsWithAgents = await AgentTeam.find({
      company: currentUser.company,
      agents: { $in: agentIds },
    }).select('name agents').lean();

    // Create a map of agentId -> team
    const agentTeamMap: Record<string, { _id: string; name: string }> = {};
    teamsWithAgents.forEach((team: any) => {
      team.agents.forEach((agentId: any) => {
        const agentIdStr = agentId.toString();
        if (agentIds.some((id: any) => id.toString() === agentIdStr)) {
          agentTeamMap[agentIdStr] = { _id: team._id.toString(), name: team.name };
        }
      });
    });

    // Add agentTeam info to each agent
    agents.forEach((agent: any) => {
      agent.agentTeam = agentTeamMap[agent._id.toString()] || null;
    });

    return NextResponse.json({ 
      agents,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      }
    });
  } catch (error: any) {
    console.error('Get agents error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch agents' },
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
      firstName,
      lastName,
      email,
      ccEmail,
      phone,
      secondPhone,
      address,
      city,
      state,
      zip,
      birthdayMonth,
      birthdayDay,
      photoUrl,
      facebookUrl,
      linkedinUrl,
      twitterUrl,
      instagramUrl,
      tiktokUrl,
      websiteUrl,
      categories,
      agency,
      agencyPhone,
      agentTeam,
      internalNotes,
      internalAdminNotes,
      excludeFromMassEmail,
      unsubscribedFromMassEmails,
    } = body;

    // Validate required fields
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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

    // Check if email already exists for this company
    const existingAgent = await Agent.findOne({
      company: currentUser.company,
      email: email.trim().toLowerCase(),
    });

    if (existingAgent) {
      return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 });
    }

    // Process categories: accept both strings (names) and ObjectIds (backward compatibility)
    const categoryIds = await getOrCreateCategories(
      Array.isArray(categories) ? categories : [],
      currentUser.company,
      currentUser._id
    );

    const agent = await Agent.create({
      firstName: firstName.trim(),
      lastName: lastName?.trim() || undefined,
      email: email.trim().toLowerCase(),
      ccEmail: ccEmail?.trim() || undefined,
      phone: phone?.trim() || undefined,
      secondPhone: secondPhone?.trim() || undefined,
      address: address?.trim() || undefined,
      city: city?.trim() || undefined,
      state: state?.trim() || undefined,
      zip: zip?.trim() || undefined,
      birthdayMonth: birthdayMonth || undefined,
      birthdayDay: birthdayDay || undefined,
      // Handle null explicitly to clear the field, undefined to keep existing value
      photoUrl: photoUrl === null ? null : (photoUrl?.trim() || undefined),
      facebookUrl: facebookUrl?.trim() || undefined,
      linkedinUrl: linkedinUrl?.trim() || undefined,
      twitterUrl: twitterUrl?.trim() || undefined,
      instagramUrl: instagramUrl?.trim() || undefined,
      tiktokUrl: tiktokUrl?.trim() || undefined,
      websiteUrl: websiteUrl?.trim() || undefined,
      categories: categoryIds,
      // Handle null explicitly to clear the field, undefined to keep existing value
      agency: agency === null ? null : (agency || undefined),
      agencyPhone: agencyPhone?.trim() || undefined,
      internalNotes: internalNotes?.trim() || undefined,
      internalAdminNotes: internalAdminNotes?.trim() || undefined,
      excludeFromMassEmail: Boolean(excludeFromMassEmail ?? false),
      unsubscribedFromMassEmails: Boolean(unsubscribedFromMassEmails ?? false),
      company: currentUser.company,
      createdBy: currentUser._id,
      updatedBy: currentUser._id,
    });

    // If agentTeam is provided, add agent to that team's agents array
    // First, remove agent from any other team (since agent can only belong to one team)
    if (agentTeam) {
      // Remove agent from any existing team
      await AgentTeam.updateMany(
        {
          company: currentUser.company,
          agents: agent._id,
        },
        {
          $pull: { agents: agent._id },
          updatedBy: currentUser._id,
        }
      );

      // Add agent to the specified team
      await AgentTeam.findOneAndUpdate(
        {
          _id: agentTeam,
          company: currentUser.company,
        },
        {
          $addToSet: { agents: agent._id },
          updatedBy: currentUser._id,
        }
      );
    }

    const populatedAgent = await Agent.findById(agent._id)
      .populate('categories', 'name color')
      .populate('agency', 'name')
      .lean();

    // Find which team this agent belongs to
    const agentTeamData = await AgentTeam.findOne({
      company: currentUser.company,
      agents: agent._id,
    }).select('name').lean();

    if (agentTeamData) {
      (populatedAgent as any).agentTeam = { _id: agentTeamData._id, name: agentTeamData.name };
    }

    return NextResponse.json(
      { message: 'Agent created successfully', agent: populatedAgent },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Create agent error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create agent' },
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
      firstName,
      lastName,
      email,
      ccEmail,
      phone,
      secondPhone,
      address,
      city,
      state,
      zip,
      birthdayMonth,
      birthdayDay,
      photoUrl,
      facebookUrl,
      linkedinUrl,
      twitterUrl,
      instagramUrl,
      tiktokUrl,
      websiteUrl,
      categories,
      agency,
      agencyPhone,
      agentTeam,
      internalNotes,
      internalAdminNotes,
      excludeFromMassEmail,
      unsubscribedFromMassEmails,
    } = body;

    if (!_id) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 });
    }

    // Validate required fields
    if (!firstName || typeof firstName !== 'string' || !firstName.trim()) {
      return NextResponse.json({ error: 'First name is required' }, { status: 400 });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
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

    // Check if email already exists for this company (excluding current agent)
    const existingAgent = await Agent.findOne({
      _id: { $ne: _id },
      company: currentUser.company,
      email: email.trim().toLowerCase(),
    });

    if (existingAgent) {
      return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 });
    }

    // Check if agent exists
    const currentAgent = await Agent.findOne({ _id, company: currentUser.company });
    if (!currentAgent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Process categories: accept both strings (names) and ObjectIds (backward compatibility)
    const categoryIds = await getOrCreateCategories(
      Array.isArray(categories) ? categories : [],
      currentUser.company,
      currentUser._id
    );

    // Find which team the agent currently belongs to
    const oldTeam = await AgentTeam.findOne({
      company: currentUser.company,
      agents: _id,
    });

    const oldAgentTeamId = oldTeam?._id?.toString();
    const newAgentTeamId = agentTeam || undefined;

    // Handle agentTeam changes
    if (oldAgentTeamId !== newAgentTeamId) {
      // Remove agent from old team if it existed
      if (oldAgentTeamId) {
        await AgentTeam.findOneAndUpdate(
          {
            _id: oldAgentTeamId,
            company: currentUser.company,
          },
          {
            $pull: { agents: _id },
            updatedBy: currentUser._id,
          }
        );
      }

      // Add agent to new team if provided
      if (newAgentTeamId) {
        await AgentTeam.findOneAndUpdate(
          {
            _id: newAgentTeamId,
            company: currentUser.company,
          },
          {
            $addToSet: { agents: _id },
            updatedBy: currentUser._id,
          }
        );
      }
    }

    const agent = await Agent.findOneAndUpdate(
      { _id, company: currentUser.company },
      {
        firstName: firstName.trim(),
        lastName: lastName?.trim() || undefined,
        email: email.trim().toLowerCase(),
        ccEmail: ccEmail?.trim() || undefined,
        phone: phone?.trim() || undefined,
        secondPhone: secondPhone?.trim() || undefined,
        address: address?.trim() || undefined,
        city: city?.trim() || undefined,
        state: state?.trim() || undefined,
        zip: zip?.trim() || undefined,
        birthdayMonth: birthdayMonth || undefined,
        birthdayDay: birthdayDay || undefined,
        // Handle null explicitly to clear the field, undefined to keep existing value
        photoUrl: photoUrl === null ? null : (photoUrl?.trim() || undefined),
        facebookUrl: facebookUrl?.trim() || undefined,
        linkedinUrl: linkedinUrl?.trim() || undefined,
        twitterUrl: twitterUrl?.trim() || undefined,
        instagramUrl: instagramUrl?.trim() || undefined,
        tiktokUrl: tiktokUrl?.trim() || undefined,
        websiteUrl: websiteUrl?.trim() || undefined,
        categories: categoryIds,
        // Handle null explicitly to clear the field, undefined to keep existing value
        agency: agency === null ? null : (agency || undefined),
        agencyPhone: agencyPhone?.trim() || undefined,
        internalNotes: internalNotes?.trim() || undefined,
        internalAdminNotes: internalAdminNotes?.trim() || undefined,
        excludeFromMassEmail: Boolean(excludeFromMassEmail ?? false),
        unsubscribedFromMassEmails: Boolean(unsubscribedFromMassEmails ?? false),
        updatedBy: currentUser._id,
      },
      { new: true }
    )
      .populate('categories', 'name color')
      .populate('agency', 'name')
      .lean();

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Find which team this agent belongs to
    const agentTeamData = await AgentTeam.findOne({
      company: currentUser.company,
      agents: _id,
    }).select('name').lean();

    if (agentTeamData) {
      (agent as any).agentTeam = { _id: agentTeamData._id, name: agentTeamData.name };
    }

    return NextResponse.json(
      { message: 'Agent updated successfully', agent }
    );
  } catch (error: any) {
    console.error('Update agent error:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return NextResponse.json({ error: 'An agent with this email already exists' }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || 'Failed to update agent' },
      { status: 500 }
    );
  }
}

