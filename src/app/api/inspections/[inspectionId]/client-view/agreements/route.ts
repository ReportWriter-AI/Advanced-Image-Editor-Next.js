import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Service from "@/src/models/Service";
import Company from "@/src/models/Company";
import Client from "@/src/models/Client";
import Agreement from "@/src/models/Agreement";
import DiscountCode from "@/src/models/DiscountCode";
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
      .populate('services.serviceId', 'name baseCost')
      .populate('clients', 'firstName lastName companyName isCompany')
      .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
      .populate('companyId', 'website')
      .populate('inspector', 'signatureImageUrl')
      .lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Calculate total price
    let subtotal = 0;
    if (inspection.services && Array.isArray(inspection.services)) {
      for (const serviceEntry of inspection.services) {
        const service = serviceEntry.serviceId;
        if (service && typeof service === 'object' && '_id' in service) {
          const serviceCost = (service as any).baseCost || 0;
          subtotal += serviceCost;

          // Add add-ons cost
          if (serviceEntry.addOns && Array.isArray(serviceEntry.addOns)) {
            const addOnsCost = serviceEntry.addOns.reduce((sum, addOn) => sum + (addOn.addFee || 0), 0);
            subtotal += addOnsCost;
          }
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
          // Calculate discount for matching services
          if (inspection.services && Array.isArray(inspection.services)) {
            for (const serviceEntry of inspection.services) {
              const service = serviceEntry.serviceId;
              if (service && typeof service === 'object' && '_id' in service) {
                const serviceId = service._id?.toString() || '';
                const serviceIdString = typeof serviceId === 'string' ? serviceId : String(serviceId);
                
                // Check if this service matches
                const serviceMatches = appliesToServices.some((appliedServiceId: any) => {
                  const appliedIdString = typeof appliedServiceId === 'string'
                    ? appliedServiceId
                    : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                  return appliedIdString === serviceIdString;
                });
                
                if (serviceMatches) {
                  const serviceCost = (service as any).baseCost || 0;
                  if (discount.type === 'percent') {
                    discountAmount += serviceCost * (discount.value / 100);
                  } else {
                    // Amount type: apply full amount per matching service
                    discountAmount += discount.value;
                  }
                }
                
                // Calculate discount for matching add-ons
                if (serviceEntry.addOns && Array.isArray(serviceEntry.addOns)) {
                  serviceEntry.addOns.forEach((addOn: any) => {
                    const addOnMatches = appliesToAddOns.some((appliedAddOn: any) => {
                      const appliedServiceId = appliedAddOn.service;
                      const appliedServiceIdString = typeof appliedServiceId === 'string'
                        ? appliedServiceId
                        : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                      const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                      
                      return appliedServiceIdString === serviceIdString &&
                        appliedAddOnName?.toLowerCase() === addOn.name?.toLowerCase();
                    });
                    
                    if (addOnMatches) {
                      const addOnFee = addOn.addFee || 0;
                      if (discount.type === 'percent') {
                        discountAmount += addOnFee * (discount.value / 100);
                      } else {
                        // Amount type: apply full amount per matching add-on
                        discountAmount += discount.value;
                      }
                    }
                  });
                }
              }
            }
          }
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Format services list
    const servicesList: string[] = [];
    if (inspection.services && Array.isArray(inspection.services)) {
      inspection.services.forEach((serviceEntry: any) => {
        const service = serviceEntry.serviceId;
        if (service && typeof service === 'object' && '_id' in service) {
          servicesList.push((service as any).name || '');
        }
      });
    }

    // Format fees list (services with costs)
    const feesList: string[] = [];
    if (inspection.services && Array.isArray(inspection.services)) {
      inspection.services.forEach((serviceEntry: any) => {
        const service = serviceEntry.serviceId;
        if (service && typeof service === 'object' && '_id' in service) {
          const serviceName = (service as any).name || '';
          const serviceCost = (service as any).baseCost || 0;
          if (serviceCost > 0) {
            feesList.push(`${serviceName}: $${serviceCost.toFixed(2)}`);
          }

          // Add add-ons fees
          if (serviceEntry.addOns && Array.isArray(serviceEntry.addOns)) {
            serviceEntry.addOns.forEach((addOn: any) => {
              if (addOn.addFee && addOn.addFee > 0) {
                feesList.push(`${addOn.name}: $${addOn.addFee.toFixed(2)}`);
              }
            });
          }
        }
      });
    }

    // Get client name (first client)
    let clientName = '';
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
        }
      }
    }

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

    // Get company website
    const company = inspection.companyId;
    const companyWebsite = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).website || '' 
      : '';

    // Get inspector signature
    const inspector = inspection.inspector;
    const inspectorSignature = (inspector && typeof inspector === 'object' && '_id' in inspector)
      ? (inspector as any).signatureImageUrl || ''
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
        county: inspection.location?.county || '',
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
        inspectionDate: inspectionDate,
        inspectionTime: inspectionTime,
        companyWebsite: companyWebsite,
        inspectorSignature: inspectorSignature,
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

