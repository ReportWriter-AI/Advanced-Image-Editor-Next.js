import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Service from "@/src/models/Service";
import Company from "@/src/models/Company";
import Client from "@/src/models/Client";
import Agreement from "@/src/models/Agreement";
import DiscountCode from "@/src/models/DiscountCode";
import "@/src/models/Agent";
import Event from "@/src/models/Event";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// GET /api/inspections/[inspectionId]/client-view/agreements?token=xxx
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    // Get token from query params
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    // Validate token is provided
    if (!token) {
      return NextResponse.json(
        { error: "Token is required" },
        { status: 401 }
      );
    }

    // Validate token format
    if (!isValidTokenFormat(token)) {
      return NextResponse.json(
        { error: "Invalid token format" },
        { status: 401 }
      );
    }

    // Find inspection by ID and token with populated data
    const inspection = await Inspection.findOne({
      _id: new mongoose.Types.ObjectId(inspectionId),
      token: token,
    })
      .populate('agreements.agreementId', 'name content')
      .populate('clients', 'firstName lastName companyName isCompany email phone address city state zip')
      .populate('agents', 'firstName lastName email phone address city state zip')
      .populate('listingAgent', 'firstName lastName email phone address city state zip')
      .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
      .populate('companyId', 'name phone address city state zip website')
      .populate('inspector', 'firstName lastName email phoneNumber profileImageUrl signatureImageUrl credentials description notes')
      .lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Calculate total price from pricing.items
    let subtotal = 0;
    const pricing = (inspection as any).pricing;
    if (pricing && pricing.items && Array.isArray(pricing.items)) {
      for (const item of pricing.items) {
        if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
          subtotal += item.price || 0;
        }
      }
    }

    // Calculate discount based on appliesToServices and appliesToAddOns
    let discountAmount = 0;
    const discountCode = inspection.discountCode;
    if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
      const discount = discountCode as any;
      if (discount.active) {
        const appliesToServices = discount.appliesToServices || [];
        const appliesToAddOns = discount.appliesToAddOns || [];
        
        // Only apply discount if there are services or add-ons configured
        if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
          // Calculate discount from pricing.items
          if (pricing && pricing.items && Array.isArray(pricing.items)) {
            for (const item of pricing.items) {
              if (item.type === 'service' && item.serviceId) {
                const serviceIdString = typeof item.serviceId === 'object' 
                  ? item.serviceId._id?.toString() || item.serviceId.toString()
                  : item.serviceId.toString();
                
                const serviceMatches = appliesToServices.some((appliedServiceId: any) => {
                  const appliedIdString = typeof appliedServiceId === 'string'
                    ? appliedServiceId
                    : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                  return appliedIdString === serviceIdString;
                });
                
                if (serviceMatches) {
                  const originalPrice = item.originalPrice || item.price || 0;
                  if (discount.type === 'percent') {
                    discountAmount += originalPrice * (discount.value / 100);
                  } else {
                    discountAmount += discount.value;
                  }
                }
              } else if (item.type === 'addon' && item.serviceId && item.addonName) {
                const serviceIdString = typeof item.serviceId === 'object'
                  ? item.serviceId._id?.toString() || item.serviceId.toString()
                  : item.serviceId.toString();
                
                const addOnMatches = appliesToAddOns.some((appliedAddOn: any) => {
                  const appliedServiceId = appliedAddOn.service;
                  const appliedServiceIdString = typeof appliedServiceId === 'string'
                    ? appliedServiceId
                    : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                  const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                  
                  return appliedServiceIdString === serviceIdString &&
                    appliedAddOnName?.toLowerCase() === item.addonName?.toLowerCase();
                });
                
                if (addOnMatches) {
                  const originalPrice = item.originalPrice || item.price || 0;
                  if (discount.type === 'percent') {
                    discountAmount += originalPrice * (discount.value / 100);
                  } else {
                    discountAmount += discount.value;
                  }
                }
              }
            }
          }
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Format services list from pricing.items
    const servicesList: string[] = [];
    if (pricing && pricing.items && Array.isArray(pricing.items)) {
      const serviceItems = pricing.items.filter((item: any) => item.type === 'service');
      serviceItems.forEach((item: any) => {
        if (item.name) {
          servicesList.push(item.name);
        }
      });
    }

    // Format fees list (services and addons with costs) from pricing.items
    const feesList: string[] = [];
    if (pricing && pricing.items && Array.isArray(pricing.items)) {
      pricing.items.forEach((item: any) => {
        if (item.price > 0) {
          if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
            feesList.push(`${item.name}: $${item.price.toFixed(2)}`);
          }
        }
      });
    }

    // Get client data (first client)
    let clientName = '';
    let clientFirstName = '';
    let clientPhone = '';
    let clientEmail = '';
    let clientAddress = '';
    
    if (inspection.clients && Array.isArray(inspection.clients) && inspection.clients.length > 0) {
      const firstClient = inspection.clients[0];
      if (firstClient && typeof firstClient === 'object' && '_id' in firstClient) {
        const client = firstClient as any;
        if (client.isCompany) {
          clientName = client.companyName || '';
        } else {
          const firstName = client.firstName || '';
          const lastName = client.lastName || '';
          clientName = `${firstName} ${lastName}`.trim();
          clientFirstName = firstName || '';
        }
        clientPhone = client.phone || '';
        clientEmail = client.email || '';
        
        // Format client address
        const clientAddrParts: string[] = [];
        if (client.address) clientAddrParts.push(client.address);
        if (client.city) clientAddrParts.push(client.city);
        if (client.state) clientAddrParts.push(client.state);
        if (client.zip) clientAddrParts.push(client.zip);
        clientAddress = clientAddrParts.join(', ');
      }
    }

    // Format client contact info
    const clientContactInfoParts: string[] = [];
    if (clientEmail) clientContactInfoParts.push(clientEmail);
    if (clientPhone) clientContactInfoParts.push(clientPhone);
    const clientContactInfo = clientContactInfoParts.join(' ');

    // Get agent data (first agent)
    let agentName = '';
    let agentFirstName = '';
    let agentPhone = '';
    let agentEmail = '';
    let agentAddress = '';
    let agentFullAddress = '';
    let agentCity = '';
    let agentState = '';
    let agentZip = '';
    
    if (inspection.agents && Array.isArray(inspection.agents) && inspection.agents.length > 0) {
      const firstAgent = inspection.agents[0];
      if (firstAgent && typeof firstAgent === 'object' && '_id' in firstAgent) {
        const agent = firstAgent as any;
        const firstName = agent.firstName || '';
        const lastName = agent.lastName || '';
        agentName = `${firstName} ${lastName}`.trim();
        agentFirstName = firstName || '';
        agentPhone = agent.phone || '';
        agentEmail = agent.email || '';
        agentAddress = agent.address || '';
        agentCity = agent.city || '';
        agentState = agent.state || '';
        agentZip = agent.zip || '';
        
        // Format agent full address
        const agentAddrParts: string[] = [];
        if (agent.address) agentAddrParts.push(agent.address);
        if (agent.city) agentAddrParts.push(agent.city);
        if (agent.state) agentAddrParts.push(agent.state);
        if (agent.zip) agentAddrParts.push(agent.zip);
        agentFullAddress = agentAddrParts.join(', ');
      }
    }

    // Format agent contact info
    const agentContactInfoParts: string[] = [];
    if (agentEmail) agentContactInfoParts.push(agentEmail);
    if (agentPhone) agentContactInfoParts.push(agentPhone);
    const agentContactInfo = agentContactInfoParts.join(' ');

    // Get listing agent data (first listing agent)
    let listingAgentName = '';
    let listingAgentFirstName = '';
    let listingAgentPhone = '';
    let listingAgentEmail = '';
    let listingAgentAddress = '';
    let listingAgentFullAddress = '';
    let listingAgentCity = '';
    let listingAgentState = '';
    let listingAgentZip = '';
    
    if (inspection.listingAgent && Array.isArray(inspection.listingAgent) && inspection.listingAgent.length > 0) {
      const firstListingAgent = inspection.listingAgent[0];
      if (firstListingAgent && typeof firstListingAgent === 'object' && '_id' in firstListingAgent) {
        const listingAgent = firstListingAgent as any;
        const firstName = listingAgent.firstName || '';
        const lastName = listingAgent.lastName || '';
        listingAgentName = `${firstName} ${lastName}`.trim();
        listingAgentFirstName = firstName || '';
        listingAgentPhone = listingAgent.phone || '';
        listingAgentEmail = listingAgent.email || '';
        listingAgentAddress = listingAgent.address || '';
        listingAgentCity = listingAgent.city || '';
        listingAgentState = listingAgent.state || '';
        listingAgentZip = listingAgent.zip || '';
        
        // Format listing agent full address
        const listingAgentAddrParts: string[] = [];
        if (listingAgent.address) listingAgentAddrParts.push(listingAgent.address);
        if (listingAgent.city) listingAgentAddrParts.push(listingAgent.city);
        if (listingAgent.state) listingAgentAddrParts.push(listingAgent.state);
        if (listingAgent.zip) listingAgentAddrParts.push(listingAgent.zip);
        listingAgentFullAddress = listingAgentAddrParts.join(', ');
      }
    }

    // Format listing agent contact info
    const listingAgentContactInfoParts: string[] = [];
    if (listingAgentEmail) listingAgentContactInfoParts.push(listingAgentEmail);
    if (listingAgentPhone) listingAgentContactInfoParts.push(listingAgentPhone);
    const listingAgentContactInfo = listingAgentContactInfoParts.join(' ');

    // Extract location fields
    const street = inspection.location?.address || '';
    const city = inspection.location?.city || '';
    const state = inspection.location?.state || '';
    const zip = inspection.location?.zip || '';
    const yearBuilt = inspection.location?.yearBuild;
    const foundation = inspection.location?.foundation || '';
    const squareFeet = inspection.location?.squareFeet;

    // Format address
    let fullAddress = '';
    if (inspection.location) {
      const parts: string[] = [];
      if (inspection.location.address) {
        if (inspection.location.unit) {
          parts.push(`${inspection.location.address}, ${inspection.location.unit}`);
        } else {
          parts.push(inspection.location.address);
        }
      }
      if (inspection.location.city) parts.push(inspection.location.city);
      if (inspection.location.state) parts.push(inspection.location.state);
      if (inspection.location.zip) parts.push(inspection.location.zip);
      fullAddress = parts.join(', ');
    }

    // Format inspection date and time
    let inspectionDate = '';
    let inspectionTime = '';
    if (inspection.date) {
      const date = new Date(inspection.date);
      inspectionDate = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      inspectionTime = date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
    }

    // Format inspection end time (full date and time)
    let inspectionEndTime = '';
    if (inspection.inspectionEndTime?.date) {
      const endDate = new Date(inspection.inspectionEndTime.date);
      const endDateStr = endDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const endTimeStr = endDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      inspectionEndTime = `${endDateStr} at ${endTimeStr}`;
    }

    // Get company data
    const company = inspection.companyId;
    const companyName = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).name || '' 
      : '';
    const companyPhone = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).phone || '' 
      : '';
    const companyAddress = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).address || '' 
      : '';
    const companyCity = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).city || '' 
      : '';
    const companyState = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).state || '' 
      : '';
    const companyZip = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).zip || '' 
      : '';
    const companyWebsite = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).website || '' 
      : '';

    // Get inspector data
    const inspector = inspection.inspector;
    let inspectorFirstName = '';
    let inspectorName = '';
    let inspectorPhone = '';
    let inspectorEmail = '';
    let inspectorCredentials = '';
    let inspectorImage = '';
    let inspectorSignature = '';
    let inspectorDescription = ''; // Field doesn't exist in User model
    let inspectorNotes = ''; // Field doesn't exist in User model
    let inspectorInitials = '';
    let inspectors = ''; // For plural placeholder, will be single inspector's name
    let inspectorsFirstNames = ''; // For plural placeholder, will be single inspector's first name
    
    if (inspector && typeof inspector === 'object' && '_id' in inspector) {
      const inspectorData = inspector as any;
      inspectorFirstName = inspectorData.firstName || '';
      const inspectorLastName = inspectorData.lastName || '';
      inspectorName = `${inspectorFirstName} ${inspectorLastName}`.trim();
      inspectorPhone = inspectorData.phoneNumber || '';
      inspectorEmail = inspectorData.email || '';
      inspectorCredentials = inspectorData.credentials || '';
      inspectorImage = inspectorData.profileImageUrl || '';
      inspectorSignature = inspectorData.signatureImageUrl || '';
      inspectorDescription = inspectorData.description || '';
      inspectorNotes = inspectorData.notes || '';
      
      // Calculate initials
      if (inspectorFirstName) {
        const firstInitial = inspectorFirstName[0] || '';
        const lastInitial = inspectorLastName ? inspectorLastName[0] : '';
        inspectorInitials = `${firstInitial}${lastInitial}`.toUpperCase();
      }
      
      // For plural placeholders, use single inspector's data
      inspectors = inspectorName;
      inspectorsFirstNames = inspectorFirstName;
    }

    // Fetch events for this inspection
    const events = await Event.find({
      inspectionId: new mongoose.Types.ObjectId(inspectionId),
    })
      .populate('inspector', 'firstName lastName')
      .sort({ startDate: 1 })
      .lean();

    // Format events data for placeholder replacement
    const formattedEvents = events.map((event: any) => {
      const inspector = event.inspector && typeof event.inspector === 'object' && '_id' in event.inspector
        ? event.inspector as any
        : null;
      
      return {
        name: event.name || '',
        startDate: event.startDate ? new Date(event.startDate) : null,
        endDate: event.endDate ? new Date(event.endDate) : null,
        inspector: inspector ? {
          firstName: inspector.firstName || '',
          lastName: inspector.lastName || '',
        } : undefined,
      };
    });

    // Calculate status fields
    const description = servicesList.join(', '); // Same as services
    const notes = inspection.internalNotes || '';
    const paid = inspection.isPaid ? 'Yes' : 'No';
    const published = (inspection.htmlReportUrl || inspection.pdfReportUrl) ? 'Yes' : 'No';
    
    // Check if all agreements are signed
    const agreements = inspection.agreements || [];
    const agreed = agreements.length === 0 
      ? 'Yes' // If no agreements, consider all signed
      : (agreements.every((a: any) => a.isSigned) ? 'Yes' : 'No');
    
    const orderId = inspection.orderId ? String(inspection.orderId) : '';

    // Generate URLs for link placeholders
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const clientViewUrl = `${baseUrl}/inspection/${inspectionId}?token=${encodeURIComponent(token || '')}`;
    const editPageUrl = `${baseUrl}/inspections/${inspectionId}/edit`;
    
    // Generate link placeholders as HTML
    const inspectionTextLink = `<a href="${editPageUrl}" style="color: #2563eb; text-decoration: underline;">View Inspection Details</a>`;
    const signAndPayLink = `<a href="${clientViewUrl}" style="display: inline-block; padding: 8px 16px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">Sign and Pay</a>`;
    const signLink = `<a href="${clientViewUrl}" style="display: inline-block; padding: 8px 16px; background-color: #16a34a; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">Sign Agreement</a>`;
    const payLink = `<a href="${clientViewUrl}" style="display: inline-block; padding: 8px 16px; background-color: #7c3aed; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">Pay Now</a>`;
    const invoiceLink = `<a href="${clientViewUrl}" style="display: inline-block; padding: 8px 16px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">View Invoice</a>`;
    const viewReportOnClientPortalLink = `<a href="${clientViewUrl}" style="display: inline-block; padding: 8px 16px; background-color: #0891b2; color: white; text-decoration: none; border-radius: 4px; font-weight: 500;">View Report</a>`;
    
    // Report published text link - mobile-friendly link to htmlReportUrl if available
    const reportPublishedTextLink = inspection.htmlReportUrl 
      ? `<a href="${inspection.htmlReportUrl}" style="color: #2563eb; text-decoration: underline; word-break: break-all;">View Published Report</a>`
      : '';

    // Format agreements
    const formattedAgreements = (inspection.agreements || []).map((agreementEntry: any) => {
      const agreement = agreementEntry.agreementId;
      if (agreement && typeof agreement === 'object' && '_id' in agreement) {
        // Convert inputData Map to plain object if it exists
        let inputData: Record<string, string> = {};
        if (agreementEntry.inputData && agreementEntry.inputData instanceof Map) {
          inputData = Object.fromEntries(agreementEntry.inputData);
        } else if (agreementEntry.inputData && typeof agreementEntry.inputData === 'object') {
          inputData = agreementEntry.inputData;
        }
        
        return {
          _id: agreement._id.toString(),
          agreementId: agreement._id.toString(),
          name: (agreement as any).name || '',
          content: (agreement as any).content || '',
          isSigned: agreementEntry.isSigned || false,
          inputData: inputData,
        };
      }
      return null;
    }).filter(Boolean);

    // Return agreements with all necessary data for placeholder replacement
    return NextResponse.json({
      agreements: formattedAgreements,
      inspectionData: {
        address: fullAddress,
        street: street,
        city: city,
        state: state,
        zip: zip,
        county: inspection.location?.county || '',
        yearBuilt: yearBuilt !== undefined ? yearBuilt : undefined,
        foundation: foundation,
        squareFeet: squareFeet !== undefined ? squareFeet : undefined,
        price: total,
        fees: feesList.join(', '),
        services: servicesList.join(', '),
        currentDate: new Date().toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        }),
        currentYear: new Date().getFullYear().toString(),
        clientName: clientName,
        clientFirstName: clientFirstName,
        clientPhone: clientPhone,
        clientEmail: clientEmail,
        clientContactInfo: clientContactInfo,
        clientAddress: clientAddress,
        inspectionDate: inspectionDate,
        inspectionTime: inspectionTime,
        inspectionEndTime: inspectionEndTime,
        inspectionTextLink: inspectionTextLink,
        signAndPayLink: signAndPayLink,
        signLink: signLink,
        payLink: payLink,
        invoiceLink: invoiceLink,
        viewReportOnClientPortalLink: viewReportOnClientPortalLink,
        reportPublishedTextLink: reportPublishedTextLink,
        companyWebsite: companyWebsite,
        inspectionCompany: companyName,
        inspectionCompanyPhone: companyPhone,
        companyAddress: companyAddress,
        companyCity: companyCity,
        companyState: companyState,
        companyZip: companyZip,
        companyPhone: companyPhone,
        inspectorSignature: inspectorSignature,
        agentName: agentName,
        agentFirstName: agentFirstName,
        agentContactInfo: agentContactInfo,
        agentPhone: agentPhone,
        agentEmail: agentEmail,
        agentAddress: agentAddress,
        agentFullAddress: agentFullAddress,
        agentCity: agentCity,
        agentState: agentState,
        agentZip: agentZip,
        listingAgentName: listingAgentName,
        listingAgentFirstName: listingAgentFirstName,
        listingAgentContactInfo: listingAgentContactInfo,
        listingAgentPhone: listingAgentPhone,
        listingAgentEmail: listingAgentEmail,
        listingAgentAddress: listingAgentAddress,
        listingAgentFullAddress: listingAgentFullAddress,
        listingAgentCity: listingAgentCity,
        listingAgentState: listingAgentState,
        listingAgentZip: listingAgentZip,
        description: description,
        notes: notes,
        paid: paid,
        published: published,
        agreed: agreed,
        orderId: orderId,
        events: formattedEvents,
        inspectorFirstName: inspectorFirstName,
        inspectorName: inspectorName,
        inspectors: inspectors,
        inspectorsFirstNames: inspectorsFirstNames,
        inspectorPhone: inspectorPhone,
        inspectorEmail: inspectorEmail,
        inspectorCredentials: inspectorCredentials,
        inspectorImage: inspectorImage,
        inspectorDescription: inspectorDescription,
        inspectorNotes: inspectorNotes,
        inspectorInitials: inspectorInitials,
      },
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching agreements:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch agreements" },
      { status: 500 }
    );
  }
}

