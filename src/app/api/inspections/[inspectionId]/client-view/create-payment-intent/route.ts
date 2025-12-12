import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia",
});

// POST /api/inspections/[inspectionId]/client-view/create-payment-intent?token=xxx
export async function POST(
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

    // Validate Stripe secret key is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error("STRIPE_SECRET_KEY is not configured");
      return NextResponse.json(
        { error: "Payment service is not configured" },
        { status: 500 }
      );
    }

    // Find inspection by ID and token
    const inspection = await Inspection.findOne({
      _id: new mongoose.Types.ObjectId(inspectionId),
      token: token,
    })
      .populate('services.serviceId', 'name baseCost')
      .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
      .lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Calculate total amount (same logic as payment calculation endpoint)
    let subtotal = 0;
    if (inspection.services && Array.isArray(inspection.services)) {
      for (const serviceEntry of inspection.services) {
        const service = serviceEntry.serviceId;
        if (service && typeof service === 'object' && '_id' in service) {
          const serviceCost = (service as any).baseCost || 0;
          subtotal += serviceCost;

          if (serviceEntry.addOns && Array.isArray(serviceEntry.addOns)) {
            const addOnsCost = serviceEntry.addOns.reduce((sum, addOn) => sum + (addOn.addFee || 0), 0);
            subtotal += addOnsCost;
          }
        }
      }
    }

    // Add approved requested addons
    if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
      const approvedAddons = inspection.requestedAddons.filter(
        (addon: any) => addon.status === 'approved'
      );
      for (const addon of approvedAddons) {
        if (addon.addFee) {
          subtotal += addon.addFee;
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
          
          // Calculate discount for approved requested addons
          if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
            const approvedAddons = inspection.requestedAddons.filter(
              (addon: any) => addon.status === 'approved'
            );
            
            for (const addon of approvedAddons) {
              const serviceIdString = addon.serviceId?.toString() || '';
              
              const addOnMatches = appliesToAddOns.some((appliedAddOn: any) => {
                const appliedServiceId = appliedAddOn.service;
                const appliedServiceIdString = typeof appliedServiceId === 'string'
                  ? appliedServiceId
                  : (appliedServiceId?._id ? String(appliedServiceId._id) : String(appliedServiceId));
                const appliedAddOnName = appliedAddOn.addOnName || appliedAddOn.addonName;
                
                return appliedServiceIdString === serviceIdString &&
                  appliedAddOnName?.toLowerCase() === addon.addonName?.toLowerCase();
              });
              
              if (addOnMatches) {
                const addOnFee = addon.addFee || 0;
                if (discount.type === 'percent') {
                  discountAmount += addOnFee * (discount.value / 100);
                } else {
                  // Amount type: apply full amount per matching add-on
                  discountAmount += discount.value;
                }
              }
            }
          }
        }
      }
    }

    const total = Math.max(0, subtotal - discountAmount);

    // Calculate amountPaid from paymentHistory
    let amountPaid = 0;
    if (inspection.paymentHistory && Array.isArray(inspection.paymentHistory)) {
      amountPaid = inspection.paymentHistory.reduce((sum, payment) => {
        return sum + (payment.amount || 0);
      }, 0);
    } else if (inspection.paymentInfo?.amountPaid) {
      // Backward compatibility: use paymentInfo.amountPaid if paymentHistory doesn't exist
      amountPaid = inspection.paymentInfo.amountPaid;
    }

    // Calculate remaining balance
    const remainingBalance = Math.max(0, total - amountPaid);

    // Check if already fully paid
    if (remainingBalance <= 0) {
      return NextResponse.json(
        { error: "This inspection has already been fully paid" },
        { status: 400 }
      );
    }

    // Use remainingBalance as the payment amount (not full total)
    const paymentAmount = remainingBalance;

    // Check for existing payment intent that hasn't been completed
    // This prevents creating multiple payment intents for the same inspection
    if (inspection.paymentInfo?.stripePaymentIntentId) {
      try {
        const existingIntent = await stripe.paymentIntents.retrieve(
          inspection.paymentInfo.stripePaymentIntentId
        );
        
        // If payment intent is still in a processable state, reuse it
        if (existingIntent.status === 'requires_payment_method' || 
            existingIntent.status === 'requires_confirmation') {
          return NextResponse.json({
            clientSecret: existingIntent.client_secret,
            paymentIntentId: existingIntent.id,
          });
        }
      } catch (error) {
        // If payment intent doesn't exist or is invalid, continue to create new one
        console.log("Existing payment intent not found or invalid, creating new one");
      }
    }

    // Convert paymentAmount to cents (Stripe uses smallest currency unit)
    const amountInCents = Math.round(paymentAmount * 100);
    const currency = inspection.paymentInfo?.currency || 'usd';

    // Create Stripe Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency,
      metadata: {
        inspectionId: inspectionId,
        token: token,
      },
      description: `Inspection Payment - ${inspectionId}`,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Store payment intent ID in inspection (temporary, before confirmation)
    await Inspection.updateOne(
      { _id: new mongoose.Types.ObjectId(inspectionId) },
      {
        $set: {
          'paymentInfo.stripePaymentIntentId': paymentIntent.id,
          'paymentInfo.currency': currency,
        },
      }
    );

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (error: any) {
    console.error("Error creating payment intent:", error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeCardError') {
      return NextResponse.json(
        { error: error.message || "Payment card error" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to create payment intent" },
      { status: 500 }
    );
  }
}

