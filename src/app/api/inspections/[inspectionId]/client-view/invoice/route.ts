import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";

// GET /api/inspections/[inspectionId]/client-view/invoice?token=xxx
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
      .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
      .populate('clients', 'firstName lastName companyName isCompany')
      .populate('companyId', 'name website')
      .lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Get discount code info
    let discountCode = '';
    let discountObj: any = null;
    const discount = inspection.discountCode;
    if (discount && typeof discount === 'object' && '_id' in discount) {
      discountObj = discount as any;
      discountCode = discountObj.code || '';
    }

    const appliesToServices = discountObj?.appliesToServices || [];
    const appliesToAddOns = discountObj?.appliesToAddOns || [];
    const hasDiscount = discountObj?.active && (appliesToServices.length > 0 || appliesToAddOns.length > 0);

    // Build invoice items with discount information
    const invoiceItems: Array<{
      description: string;
      quantity: number;
      realPrice: number;
      discountedPrice: number;
      discountCode?: string;
      serviceId?: string;
      isAddOn?: boolean;
      addOnName?: string;
    }> = [];

    const pricing = (inspection as any).pricing;
    
    // Use pricing.items if available, otherwise fall back to services
    if (pricing && pricing.items && Array.isArray(pricing.items) && pricing.items.length > 0) {
      // Build invoice items from pricing items
      for (const item of pricing.items) {
        if (item.price > 0) {
          const serviceIdString = item.serviceId 
            ? (typeof item.serviceId === 'object' 
                ? item.serviceId._id?.toString() || item.serviceId.toString()
                : item.serviceId.toString())
            : '';
          
          let itemDiscount = 0;
          let matchesDiscount = false;
          
          if (item.type === 'service' && item.serviceId) {
            // Check if service matches discount
            matchesDiscount = hasDiscount && appliesToServices.some((appliedServiceId: any) => {
              const appliedIdString = typeof appliedServiceId === 'string'
                ? appliedServiceId
                : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
              return appliedIdString === serviceIdString;
            });
            
            if (matchesDiscount && discountObj) {
              const originalPrice = item.originalPrice || item.price;
              if (discountObj.type === 'percent') {
                itemDiscount = originalPrice * (discountObj.value / 100);
              } else {
                itemDiscount = discountObj.value;
              }
            }
          } else if (item.type === 'addon' && item.serviceId && item.addonName) {
            // Check if add-on matches discount
            matchesDiscount = hasDiscount && appliesToAddOns.some((appliedAddOn: any) => {
              const appliedServiceId = appliedAddOn.service;
              const appliedServiceIdString = typeof appliedServiceId === 'string'
                ? appliedServiceId
                : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
              const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
              
              return appliedServiceIdString === serviceIdString &&
                appliedAddOnName?.toLowerCase() === item.addonName?.toLowerCase();
            });
            
            if (matchesDiscount && discountObj) {
              const originalPrice = item.originalPrice || item.price;
              if (discountObj.type === 'percent') {
                itemDiscount = originalPrice * (discountObj.value / 100);
              } else {
                itemDiscount = discountObj.value;
              }
            }
          }
          
          invoiceItems.push({
            description: item.name,
            quantity: 1,
            realPrice: item.price, // Use inspection-specific price
            discountedPrice: Math.max(0, item.price - itemDiscount), // Apply discount to original price but subtract from inspection price
            discountCode: matchesDiscount ? discountCode : undefined,
            serviceId: serviceIdString,
            isAddOn: item.type === 'addon',
            addOnName: item.type === 'addon' ? item.addonName : undefined,
          });
        }
      }
    }

    // Add approved requested addons
    if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
      const approvedAddons = inspection.requestedAddons.filter(
        (addon: any) => addon.status === 'approved'
      );
      for (const addon of approvedAddons) {
        if (addon.addFee && addon.addFee > 0) {
          const serviceIdString = addon.serviceId?.toString() || '';
          
          // Check if add-on matches discount
          const addOnMatches = hasDiscount && appliesToAddOns.some((appliedAddOn: any) => {
            const appliedServiceId = appliedAddOn.service;
            const appliedServiceIdString = typeof appliedServiceId === 'string'
              ? appliedServiceId
              : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
            const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
            
            return appliedServiceIdString === serviceIdString &&
              appliedAddOnName?.toLowerCase() === addon.addonName?.toLowerCase();
          });
          
          let itemDiscount = 0;
          if (addOnMatches && discountObj) {
            if (discountObj.type === 'percent') {
              itemDiscount = addon.addFee * (discountObj.value / 100);
            } else {
              itemDiscount = discountObj.value;
            }
          }
          
          invoiceItems.push({
            description: addon.addonName,
            quantity: 1,
            realPrice: addon.addFee,
            discountedPrice: Math.max(0, addon.addFee - itemDiscount),
            discountCode: addOnMatches ? discountCode : undefined,
            serviceId: serviceIdString,
            isAddOn: true,
            addOnName: addon.addonName,
          });
        }
      }
    }

    // Calculate totals
    const subtotal = invoiceItems.reduce((sum, item) => sum + item.realPrice, 0);
    const total = invoiceItems.reduce((sum, item) => sum + item.discountedPrice, 0);
    const discountAmount = subtotal - total;

    // Get client name
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

    // Get company name
    const company = inspection.companyId;
    const companyName = (company && typeof company === 'object' && '_id' in company) 
      ? (company as any).name || '' 
      : '';

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

    // Format inspection date
    let inspectionDate = '';
    if (inspection.date) {
      const date = new Date(inspection.date);
      inspectionDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    return NextResponse.json({
      invoiceNumber: inspection.orderId ? `INV-${inspection.orderId}` : `INV-${inspectionId.slice(-8)}`,
      invoiceDate: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      }),
      inspectionDate,
      clientName,
      companyName,
      address: fullAddress,
      items: invoiceItems,
      subtotal: Math.round(subtotal * 100) / 100,
      discountAmount: Math.round(discountAmount * 100) / 100,
      discountCode,
      total: Math.round(total * 100) / 100,
      currency: inspection.paymentInfo?.currency || 'usd',
      isPaid: inspection.isPaid || false,
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error fetching invoice data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch invoice data" },
      { status: 500 }
    );
  }
}



