import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import dbConnect from '@/lib/db';
import { createInspection } from '@/lib/inspection';
import Inspection from '@/src/models/Inspection';
import DiscountCode from '@/src/models/DiscountCode';
import { createOrUpdateClient, createOrUpdateAgent } from '@/lib/client-agent-utils';
import { processInspectionPostCreation } from '@/lib/inspection-utils';

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
        { error: 'Invalid company ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Extract data from request body
    const date = body.date;
    const inspector = body.inspector;
    const services = body.services || [];
    const discountCodeString = body.discountCode;
    const location = body.location;
    const clients = body.clients || [];
    const agents = body.agents || [];
    const listingAgents = body.listingAgents || [];
    const referralSource = body.referralSource;
    const clientNote = body.clientNote;
    const clientAgreedToTerms = body.clientAgreedToTerms;
    const customData = body.customData || {};

    // Validate required fields
    if (!date) {
      return NextResponse.json(
        { error: 'Date is required' },
        { status: 400 }
      );
    }

    if (!inspector || !mongoose.Types.ObjectId.isValid(inspector)) {
      return NextResponse.json(
        { error: 'Valid inspector is required' },
        { status: 400 }
      );
    }

    if (services.length === 0) {
      return NextResponse.json(
        { error: 'At least one service is required' },
        { status: 400 }
      );
    }

    if (clients.length === 0 || !clients[0]?.email) {
      return NextResponse.json(
        { error: 'Client information is required' },
        { status: 400 }
      );
    }

    if (!clientAgreedToTerms) {
      return NextResponse.json(
        { error: 'You must agree to the terms and conditions' },
        { status: 400 }
      );
    }

    // Convert discount code string to ObjectId if provided
    let discountCodeId: string | undefined = undefined;
    if (discountCodeString && discountCodeString.trim()) {
      const discountCode = await DiscountCode.findOne({
        company: companyId,
        code: discountCodeString.trim(),
        active: true,
      }).lean();

      if (discountCode) {
        // Check if expired
        if (discountCode.expirationDate && new Date(discountCode.expirationDate) < new Date()) {
          return NextResponse.json(
            { error: 'Discount code has expired' },
            { status: 400 }
          );
        }

        // Check if max uses exceeded
        if (discountCode.maxUses && discountCode.usageCount >= discountCode.maxUses) {
          return NextResponse.json(
            { error: 'Discount code has reached maximum uses' },
            { status: 400 }
          );
        }

        discountCodeId = discountCode._id.toString();
      }
      // If discount code not found, we'll just ignore it (don't fail the request)
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    // Create the inspection with status "unconfirmed"
    const inspection = await createInspection({
      status: 'unconfirmed',
      date,
      companyId,
      inspector,
      services,
      discountCode: discountCodeId,
      location,
      referralSource: referralSource?.trim() || undefined,
      confirmedInspection: false,
      clientNote: clientNote?.trim() || undefined,
      clientAgreedToTerms,
      customData,
    });

    // Handle clients creation/update
    const clientIds: mongoose.Types.ObjectId[] = [];
    
    if (clients.length > 0) {
      for (const clientData of clients) {
        const clientId = await createOrUpdateClient(
          clientData,
          companyObjectId,
          undefined // No createdById for public API
        );

        if (clientId) {
          clientIds.push(clientId);
        }
      }

      // Update inspection with all client IDs
      if (inspection?._id && clientIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          clients: clientIds,
        });
      }
    }

    // Handle agents creation/update
    const agentIds: mongoose.Types.ObjectId[] = [];
    
    if (agents.length > 0) {
      for (const agentData of agents) {
        const agentId = await createOrUpdateAgent(
          agentData,
          companyObjectId,
          undefined // No createdById for public API
        );

        if (agentId) {
          agentIds.push(agentId);
        }
      }

      // Update inspection with all agent IDs
      if (inspection?._id && agentIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          agents: agentIds,
        });
      }
    }

    // Handle listing agents creation/update
    const listingAgentIds: mongoose.Types.ObjectId[] = [];
    
    if (listingAgents.length > 0) {
      for (const agentData of listingAgents) {
        const agentId = await createOrUpdateAgent(
          agentData,
          companyObjectId,
          undefined // No createdById for public API
        );

        if (agentId) {
          listingAgentIds.push(agentId);
        }
      }

      // Update inspection with all listing agent IDs
      if (inspection?._id && listingAgentIds.length > 0) {
        await Inspection.findByIdAndUpdate(inspection._id, {
          listingAgent: listingAgentIds,
        });
      }
    }

    // Process post-creation tasks: Order ID, token generation, and agreement collection
    if (inspection?._id) {
      await processInspectionPostCreation(
        inspection._id,
        companyObjectId,
        services
      );
    }

    // Increment discount code usage count if applicable
    if (discountCodeId) {
      await DiscountCode.findByIdAndUpdate(discountCodeId, {
        $inc: { usageCount: 1 },
      });
    }

    return NextResponse.json(
      {
        message: 'Inspection scheduled successfully',
        inspection: {
          id: inspection?._id || inspection?.id,
          status: 'unconfirmed',
        },
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Public inspection creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to schedule inspection' },
      { status: 500 }
    );
  }
}

