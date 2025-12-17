import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import Inspection from "@/src/models/Inspection";
import mongoose from "mongoose";
import { getCurrentUser } from "@/lib/auth-helpers";

// Helper function to calculate payment totals (same logic as payment GET endpoint)
async function calculatePaymentTotals(inspectionId: string) {
  const inspection = await Inspection.findById(inspectionId)
    .populate('discountCode', 'code type value active appliesToServices appliesToAddOns')
    .lean();

  if (!inspection) {
    return null;
  }

  // Calculate subtotal from pricing.items
  let subtotal = 0;
  const pricing = (inspection as any).pricing;
  
  if (pricing && pricing.items && Array.isArray(pricing.items) && pricing.items.length > 0) {
    for (const item of pricing.items) {
      if (item.type === 'service' || item.type === 'addon' || item.type === 'additional') {
        subtotal += item.price || 0;
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

  // Calculate discount
  let discountAmount = 0;
  const discountCode = inspection.discountCode;
  if (discountCode && typeof discountCode === 'object' && '_id' in discountCode) {
    const discount = discountCode as any;
    if (discount.active) {
      const appliesToServices = discount.appliesToServices || [];
      const appliesToAddOns = discount.appliesToAddOns || [];
      
      if (appliesToServices.length > 0 || appliesToAddOns.length > 0) {
        if (pricing && pricing.items && Array.isArray(pricing.items) && pricing.items.length > 0) {
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
    amountPaid = inspection.paymentInfo.amountPaid;
  }

  const remainingBalance = Math.max(0, total - amountPaid);
  const isPaid = amountPaid >= total;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discountAmount: Math.round(discountAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
    amountPaid: Math.round(amountPaid * 100) / 100,
    remainingBalance: Math.round(remainingBalance * 100) / 100,
    isPaid,
  };
}

// POST /api/inspections/[inspectionId]/payment-history
// Create a new payment entry
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { amount, paidAt, currency = 'usd', paymentMethod = 'Cash' } = body;

    // Validate required fields
    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: "Amount is required and must be a number" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Get inspection to check if it exists and calculate totals
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Calculate current totals and remaining balance
    const totals = await calculatePaymentTotals(inspectionId);
    if (!totals) {
      return NextResponse.json(
        { error: "Failed to calculate payment totals" },
        { status: 500 }
      );
    }

    // Validate amount does not exceed remaining balance
    if (amount > totals.remainingBalance) {
      return NextResponse.json(
        { 
          error: `Payment amount cannot exceed remaining balance of $${totals.remainingBalance.toFixed(2)}`,
          remainingBalance: totals.remainingBalance
        },
        { status: 400 }
      );
    }

    // Create payment entry
    const paymentEntry = {
      amount: Math.round(amount * 100) / 100, // Round to 2 decimal places
      paidAt: paidAt ? new Date(paidAt) : new Date(),
      currency,
      paymentMethod,
    };

    // Add payment to history and update totals
    const currentAmountPaid = totals.amountPaid;
    const newAmountPaid = currentAmountPaid + paymentEntry.amount;
    const newRemainingBalance = Math.max(0, totals.total - newAmountPaid);
    const newIsPaid = newAmountPaid >= totals.total;

    const updatedInspection = await Inspection.findByIdAndUpdate(
      inspectionId,
      {
        $push: {
          paymentHistory: paymentEntry,
        },
        $set: {
          'paymentInfo.amountPaid': newAmountPaid,
          'paymentInfo.paidAt': new Date(),
          'paymentInfo.currency': currency,
          'paymentInfo.paymentMethod': paymentMethod,
          isPaid: newIsPaid,
        },
      },
      { new: true }
    ).lean();

    if (!updatedInspection) {
      return NextResponse.json(
        { error: "Failed to update inspection" },
        { status: 500 }
      );
    }

    // Return updated payment info
    const updatedTotals = await calculatePaymentTotals(inspectionId);
    return NextResponse.json({
      success: true,
      message: "Payment added successfully",
      payment: paymentEntry,
      ...updatedTotals,
      paymentHistory: (updatedInspection as any).paymentHistory || [],
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error creating payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create payment" },
      { status: 500 }
    );
  }
}

// PUT /api/inspections/[inspectionId]/payment-history
// Update an existing payment entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { paymentId, amount, paidAt, currency, paymentMethod } = body;

    // Validate required fields
    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json(
        { error: "Valid payment ID is required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json(
        { error: "Amount is required and must be a number" },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be greater than 0" },
        { status: 400 }
      );
    }

    // Get inspection to find the payment and calculate totals
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Find the payment to update
    const paymentHistory = (inspection as any).paymentHistory || [];
    const paymentIndex = paymentHistory.findIndex(
      (p: any) => p._id?.toString() === paymentId
    );

    if (paymentIndex === -1) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    const oldPayment = paymentHistory[paymentIndex];
    const oldAmount = oldPayment.amount || 0;

    // Calculate current totals
    const totals = await calculatePaymentTotals(inspectionId);
    if (!totals) {
      return NextResponse.json(
        { error: "Failed to calculate payment totals" },
        { status: 500 }
      );
    }

    // Calculate what the new amountPaid would be after update
    // Remove old payment amount, add new payment amount
    const newAmountPaid = totals.amountPaid - oldAmount + amount;
    const newRemainingBalance = Math.max(0, totals.total - newAmountPaid);

    // Validate new amount does not exceed remaining balance (accounting for old payment)
    if (newAmountPaid > totals.total) {
      const maxAllowed = totals.remainingBalance + oldAmount;
      return NextResponse.json(
        { 
          error: `Payment amount cannot exceed remaining balance. Maximum allowed: $${maxAllowed.toFixed(2)}`,
          remainingBalance: totals.remainingBalance,
          maxAllowed
        },
        { status: 400 }
      );
    }

    // Update the payment entry
    const updateFields: any = {
      [`paymentHistory.${paymentIndex}.amount`]: Math.round(amount * 100) / 100,
      [`paymentHistory.${paymentIndex}.paidAt`]: paidAt ? new Date(paidAt) : oldPayment.paidAt,
    };

    if (currency !== undefined) {
      updateFields[`paymentHistory.${paymentIndex}.currency`] = currency;
    }

    if (paymentMethod !== undefined) {
      updateFields[`paymentHistory.${paymentIndex}.paymentMethod`] = paymentMethod;
    }

    const newIsPaid = newAmountPaid >= totals.total;

    const updatedInspection = await Inspection.findByIdAndUpdate(
      inspectionId,
      {
        $set: {
          ...updateFields,
          'paymentInfo.amountPaid': newAmountPaid,
          'paymentInfo.paidAt': new Date(),
          isPaid: newIsPaid,
        },
      },
      { new: true }
    ).lean();

    if (!updatedInspection) {
      return NextResponse.json(
        { error: "Failed to update payment" },
        { status: 500 }
      );
    }

    // Return updated payment info
    const updatedTotals = await calculatePaymentTotals(inspectionId);
    return NextResponse.json({
      success: true,
      message: "Payment updated successfully",
      ...updatedTotals,
      paymentHistory: (updatedInspection as any).paymentHistory || [],
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error updating payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update payment" },
      { status: 500 }
    );
  }
}

// DELETE /api/inspections/[inspectionId]/payment-history?paymentId=xxx
// Delete a payment entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inspectionId: string }> }
) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(req);
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inspectionId } = await params;

    // Validate inspection ID format
    if (!mongoose.Types.ObjectId.isValid(inspectionId)) {
      return NextResponse.json(
        { error: "Invalid inspection ID" },
        { status: 400 }
      );
    }

    // Get paymentId from query params
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return NextResponse.json(
        { error: "Valid payment ID is required" },
        { status: 400 }
      );
    }

    // Get inspection to verify payment exists
    const inspection = await Inspection.findById(inspectionId).lean();
    if (!inspection) {
      return NextResponse.json(
        { error: "Inspection not found" },
        { status: 404 }
      );
    }

    // Find the payment to delete
    const paymentHistory = (inspection as any).paymentHistory || [];
    const payment = paymentHistory.find(
      (p: any) => p._id?.toString() === paymentId
    );

    if (!payment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 }
      );
    }

    // Remove payment from history and recalculate totals
    const updatedInspection = await Inspection.findByIdAndUpdate(
      inspectionId,
      {
        $pull: {
          paymentHistory: { _id: new mongoose.Types.ObjectId(paymentId) },
        },
      },
      { new: true }
    ).lean();

    if (!updatedInspection) {
      return NextResponse.json(
        { error: "Failed to delete payment" },
        { status: 500 }
      );
    }

    // Recalculate totals after deletion
    const totals = await calculatePaymentTotals(inspectionId);
    if (!totals) {
      return NextResponse.json(
        { error: "Failed to calculate payment totals" },
        { status: 500 }
      );
    }

    // Update paymentInfo and isPaid status
    await Inspection.findByIdAndUpdate(
      inspectionId,
      {
        $set: {
          'paymentInfo.amountPaid': totals.amountPaid,
          'paymentInfo.paidAt': totals.amountPaid > 0 ? new Date() : undefined,
          isPaid: totals.isPaid,
        },
      }
    );

    // Return updated payment info
    return NextResponse.json({
      success: true,
      message: "Payment deleted successfully",
      ...totals,
      paymentHistory: (updatedInspection as any).paymentHistory || [],
    }, { status: 200 });
  } catch (error: any) {
    console.error("Error deleting payment:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete payment" },
      { status: 500 }
    );
  }
}

