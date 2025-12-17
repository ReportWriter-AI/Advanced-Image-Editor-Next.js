import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { isValidTokenFormat } from "@/src/lib/token-utils";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2025-02-24.acacia",
});

// POST /api/inspections/[inspectionId]/client-view/confirm-payment?token=xxx
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

    // Get payment intent ID from request body
    const body = await req.json();
    const { paymentIntentId } = body;

    if (!paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent ID is required" },
        { status: 400 }
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
      .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
      .lean();

    // If inspection not found or token doesn't match
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found or invalid token" },
        { status: 404 }
      );
    }

    // Verify payment intent belongs to this inspection
    if (inspection.paymentInfo?.stripePaymentIntentId !== paymentIntentId) {
      return NextResponse.json(
        { error: "Payment intent does not match this inspection" },
        { status: 400 }
      );
    }

    // Retrieve payment intent from Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Verify payment intent metadata matches
    if (paymentIntent.metadata.inspectionId !== inspectionId || 
        paymentIntent.metadata.token !== token) {
      return NextResponse.json(
        { error: "Payment intent metadata mismatch" },
        { status: 400 }
      );
    }

    // Check payment intent status
    if (paymentIntent.status === 'succeeded') {
      // Check if this payment intent was already processed (idempotency)
      const paymentAmount = paymentIntent.amount / 100; // Convert from cents to dollars
      const existingPayment = inspection.paymentHistory?.find(
        (p) => p.stripePaymentIntentId === paymentIntent.id
      );

      if (existingPayment) {
        // Payment already processed (webhook handled it)
        // Calculate current status
        const currentAmountPaid = inspection.paymentHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
        
        // Calculate total (same logic as payment endpoint) from pricing.items
        let subtotal = 0;
        const pricing = (inspection as any).pricing;
        if (pricing && pricing.items && Array.isArray(pricing.items)) {
          for (const item of pricing.items) {
            if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
              subtotal += item.price || 0;
            }
          }
        }
        if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
          const approvedAddons = inspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
          for (const addon of approvedAddons) {
            if (addon.addFee) {
              subtotal += addon.addFee;
            }
          }
        }

        // Calculate discount
        let discountAmount = 0;
        const discountCode = inspection.discountCode;
        if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
          const discount = discountCode as any;
          if (discount.active) {
            const appliesToServices = discount.appliesToServices || [];
            const appliesToAddOns = discount.appliesToAddOns || [];
            
            if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
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
        const isPaid = currentAmountPaid >= total;

        return NextResponse.json({
          success: true,
          message: "Payment already confirmed",
          isPaid: isPaid,
        });
      }

      // Payment not yet processed, add to history
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

      // Calculate total to determine if fully paid (same logic as payment endpoint) from pricing.items
      let subtotal = 0;
      const pricing = (inspection as any).pricing;
      if (pricing && pricing.items && Array.isArray(pricing.items)) {
        for (const item of pricing.items) {
          if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
            subtotal += item.price || 0;
          }
        }
      }
      if (inspection.requestedAddons && Array.isArray(inspection.requestedAddons)) {
        const approvedAddons = inspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
        for (const addon of approvedAddons) {
          if (addon.addFee) {
            subtotal += addon.addFee;
          }
        }
      }

      // Calculate discount
      let discountAmount = 0;
      const discountCode = inspection.discountCode;
      if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
        const discount = discountCode as any;
        if (discount.active) {
          const appliesToServices = discount.appliesToServices || [];
          const appliesToAddOns = discount.appliesToAddOns || [];
          
          if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
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
        // Payment already exists (webhook processed it first)
        // Re-fetch to get current status
        const updatedInspection = await Inspection.findById(inspectionId)
          .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
          .lean();
        
        if (updatedInspection) {
          const currentAmountPaid = updatedInspection.paymentHistory?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;
          
          // Calculate total
          let subtotal = 0;
          const updatedPricing = (updatedInspection as any).pricing;
          if (updatedPricing && updatedPricing.items && Array.isArray(updatedPricing.items)) {
            for (const item of updatedPricing.items) {
              if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
                subtotal += item.price || 0;
              }
            }
          }
          if (updatedInspection.requestedAddons && Array.isArray(updatedInspection.requestedAddons)) {
            const approvedAddons = updatedInspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
            for (const addon of approvedAddons) {
              if (addon.addFee) {
                subtotal += addon.addFee;
              }
            }
          }

          let discountAmount = 0;
          const discountCode = updatedInspection.discountCode;
          if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
            const discount = discountCode as any;
            if (discount.active) {
              const appliesToServices = discount.appliesToServices || [];
              const appliesToAddOns = discount.appliesToAddOns || [];
              
              if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
                if (updatedPricing && updatedPricing.items && Array.isArray(updatedPricing.items)) {
                  for (const item of updatedPricing.items) {
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
                
                if (updatedInspection.requestedAddons && Array.isArray(updatedInspection.requestedAddons)) {
                  const approvedAddons = updatedInspection.requestedAddons.filter((addon: any) => addon.status === 'approved');
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
          const isPaid = currentAmountPaid >= total;

          return NextResponse.json({
            success: true,
            message: "Payment already confirmed (processed by webhook)",
            isPaid: isPaid,
          });
        }
      }

      return NextResponse.json({
        success: true,
        message: "Payment confirmed successfully",
        isPaid: isPaid,
      });
    } else if (paymentIntent.status === 'requires_payment_method' || 
               paymentIntent.status === 'requires_confirmation') {
      return NextResponse.json(
        { error: "Payment has not been completed yet" },
        { status: 400 }
      );
    } else if (paymentIntent.status === 'canceled') {
      return NextResponse.json(
        { error: "Payment was canceled" },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: `Payment status: ${paymentIntent.status}` },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error confirming payment:", error);
    
    // Handle Stripe-specific errors
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: error.message || "Invalid payment request" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to confirm payment" },
      { status: 500 }
    );
  }
}

