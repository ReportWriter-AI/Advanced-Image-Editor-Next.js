import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import Stripe from "stripe";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia",
});

// Disable body parsing, we need the raw body for webhook signature verification
export const runtime = 'nodejs';

// POST /api/webhooks/stripe
export async function POST(req: NextRequest) {
  try {
    await dbConnect();

    // Validate webhook secret is configured
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not configured");
      return NextResponse.json(
        { error: "Webhook secret is not configured" },
        { status: 500 }
      );
    }

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("Webhook signature verification failed:", err.message);
      return NextResponse.json(
        { error: `Webhook signature verification failed: ${err.message}` },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        // Extract inspection ID from metadata
        const inspectionId = paymentIntent.metadata.inspectionId;
        
        if (!inspectionId) {
          console.error("Payment intent missing inspectionId in metadata");
          return NextResponse.json(
            { error: "Missing inspection ID in payment metadata" },
            { status: 400 }
          );
        }

        // Validate inspection ID format
        if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
          console.error("Invalid inspection ID format:", inspectionId);
          return NextResponse.json(
            { error: "Invalid inspection ID format" },
            { status: 400 }
          );
        }

        // Get inspection to check if payment already processed (idempotency)
        const inspection = await Inspection.findById(inspectionId)
          .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
          .lean();
        if (!inspection) {
          console.log(`Inspection ${inspectionId} not found`);
          return NextResponse.json({ received: true });
        }

        // Check if this payment intent was already processed
        const paymentAmount = paymentIntent.amount / 100; // Convert from cents to dollars
        const existingPayment = inspection.paymentHistory?.find(
          (p) => p.stripePaymentIntentId === paymentIntent.id
        );

        if (existingPayment) {
          // Payment already processed (idempotency)
          console.log(`Payment intent ${paymentIntent.id} already processed for inspection ${inspectionId}`);
          return NextResponse.json({ received: true });
        }

        // Add payment to history
        const paymentEntry = {
          amount: paymentAmount,
          paidAt: new Date(),
          stripePaymentIntentId: paymentIntent.id,
          currency: paymentIntent.currency || 'usd',
          paymentMethod: paymentIntent.payment_method_types?.[0] || 'unknown',
        };

        // Calculate new amountPaid from updated history
        const currentAmountPaid = inspection.paymentHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        const newAmountPaid = currentAmountPaid + paymentAmount;

      // Calculate total to determine if fully paid (same logic as payment endpoint)
      // Use pricing.items
      let subtotal = 0;
      const pricing = (inspection as any).pricing;
      
      if (pricing && pricing.items && Array.isArray(pricing.items) && pricing.items.length > 0) {
        // Use pricing items for subtotal (inspection-specific prices)
        for (const item of pricing.items) {
          if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
            subtotal += item.price || 0;
          }
        }
      }
      
      // Add approved requested addons (these are not in pricing.items)
      if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
        const approvedAddons = inspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
        for (const addon of approvedAddons) {
          if (addon.addFee) {
            subtotal += addon.addFee;
          }
        }
      }

      // Calculate discount
      // Discounts apply to original prices (from Service model), not inspection-specific prices
      let discountAmount = 0;
      const discountCode = inspection.discountCode;
      if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
        const discount = discountCode as any;
        if (discount.active) {
          const appliesToServices = discount.appliesToServices || [];
          const appliesToAddOns = discount.appliesToAddOns || [];
          
          if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
            if (pricing && pricing.items && Array.isArray(pricing.items) && pricing.items.length > 0) {
              // Use pricing items - apply discount to originalPrice
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
                    const originalPrice = item.originalPrice || 0;
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
                    const originalPrice = item.originalPrice || 0;
                    if (discount.type === 'percent') {
                      discountAmount += originalPrice * (discount.value / 100);
                    } else {
                      discountAmount += discount.value;
                    }
                  }
                }
              }
            }
            
            // Calculate discount for approved requested addons (not in pricing.items)
            if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
              const approvedAddons = inspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
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
                    discountAmount += discount.value;
                  }
                }
              }
            }
          }
        }
      }

      const total = Math.max(0, subtotal - discountAmount);
        const isPaid = newAmountPaid >= total;

        // Update inspection with payment history entry atomically
        // Only add if payment intent ID doesn't already exist in paymentHistory
        const updateResult = await Inspection.findOneAndUpdate(
          {
            _id: new mongoose.Types.ObjectId(inspectionId),
            'paymentHistory.stripePaymentIntentId': { $ne: paymentIntent.id }, // Only update if payment intent ID doesn't exist
          },
          {
            $push: {
              paymentHistory: paymentEntry,
            },
            $set: {
              'paymentInfo.stripePaymentIntentId': paymentIntent.id,
              'paymentInfo.amountPaid': newAmountPaid,
              'paymentInfo.paidAt': new Date(),
              'paymentInfo.currency': paymentIntent.currency || 'usd',
              'paymentInfo.paymentMethod': paymentIntent.payment_method_types?.[0] || 'unknown',
              isPaid: isPaid,
            },
          },
          { new: true }
        );

        if (!updateResult) {
          // Payment already exists (race condition - another process added it)
          console.log(`Payment intent ${paymentIntent.id} already processed for inspection ${inspectionId} (race condition)`);
          return NextResponse.json({ received: true });
        }

        console.log(`Payment confirmed for inspection ${inspectionId}: $${paymentAmount} (Total paid: $${newAmountPaid})`);

        // Check if inspection is now fully paid and trigger automation
        if (isPaid) {
          const { checkPaymentTriggers } = await import('@/src/lib/automation-trigger-helper');
          await checkPaymentTriggers(inspectionId);
        }
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inspectionId = paymentIntent.metadata.inspectionId;
        
        // Log the failure but don't update inspection (keep isPaid as false)
        console.error(`Payment failed for inspection ${inspectionId}:`, paymentIntent.last_payment_error);
        break;
      }

      case 'payment_intent.canceled': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const inspectionId = paymentIntent.metadata.inspectionId;
        
        // Log the cancellation but don't update inspection
        console.log(`Payment canceled for inspection ${inspectionId}`);
        break;
      }

      default:
        // Unhandled event type
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Return a response to acknowledge receipt of the event
    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return NextResponse.json(
      { error: error.message || "Webhook processing failed" },
      { status: 500 }
    );
  }
}

