/**
 * Replaces placeholders in automation email/SMS content with actual inspection data
 */

import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import Client from '@/src/models/Client';
import Agent from '@/src/models/Agent';
import Service from '@/src/models/Service';
import Company from '@/src/models/Company';
import User from '@/src/models/User';
import { format } from 'date-fns';

export interface PlaceholderContext {
  inspection: any; // Inspection document with populated fields
  company?: any; // Company document
}

/**
 * Replaces all placeholders in email/SMS content with actual values
 */
export async function replacePlaceholders(
  content: string,
  inspectionId: string | mongoose.Types.ObjectId
): Promise<string> {
  // Fetch inspection with all necessary populated fields
  const inspection = await Inspection.findById(inspectionId)
    .populate('inspector', 'firstName lastName email phoneNumber')
    .populate('clients', 'firstName lastName companyName email phone isCompany')
    .populate('agents', 'firstName lastName email phone')
    .populate('listingAgent', 'firstName lastName email phone')
    .populate('companyId', 'name website')
    .lean();

  if (!inspection) {
    return content; // Return original if inspection not found
  }

  // Fetch company if needed
  const company = await Company.findById(inspection.companyId).lean();

  const context: PlaceholderContext = {
    inspection: inspection as any,
    company: company as any,
  };

  return replacePlaceholdersWithContext(content, context);
}

/**
 * Replaces placeholders using already-fetched context
 */
export function replacePlaceholdersWithContext(
  content: string,
  context: PlaceholderContext
): string {
  let replaced = content;
  const { inspection, company } = context;

  // Helper to format date
  const formatDate = (date: Date | string | undefined): string => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'MMMM d, yyyy');
    } catch {
      return '';
    }
  };

  // Helper to format time
  const formatTime = (date: Date | string | undefined): string => {
    if (!date) return '';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, 'h:mm a');
    } catch {
      return '';
    }
  };

  // Helper to format address
  const formatAddress = (): string => {
    const loc = inspection.location;
    if (!loc) return '';
    const parts = [
      loc.address,
      loc.unit,
      loc.city,
      loc.state,
      loc.zip,
    ].filter(Boolean);
    return parts.join(', ');
  };

  // Helper to get client name
  const getClientName = (): string => {
    if (!inspection.clients || inspection.clients.length === 0) return '';
    const client = Array.isArray(inspection.clients) ? inspection.clients[0] : inspection.clients;
    if (client.isCompany) {
      return client.companyName || '';
    }
    return `${client.firstName || ''} ${client.lastName || ''}`.trim();
  };

  // Helper to get services list
  const getServices = (): string => {
    if (!inspection.pricing?.items) return '';
    return inspection.pricing.items
      .filter((item: any) => item.type === 'service')
      .map((item: any) => item.name)
      .join(', ');
  };

  // Helper to get fees
  const getFees = (): string => {
    if (!inspection.pricing?.items) return '';
    return inspection.pricing.items
      .map((item: any) => `${item.name}: $${item.price?.toFixed(2) || '0.00'}`)
      .join(', ');
  };

  // Helper to get total price
  const getPrice = (): string => {
    if (!inspection.pricing?.items) return '';
    const total = inspection.pricing.items.reduce(
      (sum: number, item: any) => sum + (item.price || 0),
      0
    );
    return `$${total.toFixed(2)}`;
  };

  // Replacements map
  const replacements: Array<[RegExp, string]> = [
    // Inspection Property Details
    [/\[ADDRESS\]/g, formatAddress()],
    [/\[COUNTY\]/g, inspection.location?.county || ''],

    // Fees and Services
    [/\[PRICE\]/g, getPrice()],
    [/\[FEES\]/g, getFees()],
    [/\[SERVICES\]/g, getServices()],
    [/\[CURRENT_DATE\]/g, formatDate(new Date())],
    [/\[CURRENT_YEAR\]/g, new Date().getFullYear().toString()],

    // Client Information
    [/\[CLIENT_NAME\]/g, getClientName()],

    // Inspection Details
    [/\[INSPECTION_DATE\]/g, formatDate(inspection.date)],
    [/\[INSPECTION_TIME\]/g, formatTime(inspection.date)],

    // Company Information
    [/\[COMPANY_WEBSITE\]/g, company?.website || ''],
  ];

  // Apply all replacements
  replacements.forEach(([regex, value]) => {
    replaced = replaced.replace(regex, value);
  });

  return replaced;
}

