/**
 * Communication service for sending automation emails and SMS
 */

import { Resend } from 'resend';
import { replacePlaceholders } from './placeholder-replacer';
import mongoose from 'mongoose';
import Inspection from '@/src/models/Inspection';
import Client from '@/src/models/Client';
import Agent from '@/src/models/Agent';
import User from '@/src/models/User';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

export interface SendEmailParams {
  inspectionId: string | mongoose.Types.ObjectId;
  to: string[];
  cc?: string[];
  bcc?: string[];
  from: 'COMPANY' | 'INSPECTOR';
  subject: string;
  body: string; // HTML content
}

export interface SendSMSParams {
  inspectionId: string | mongoose.Types.ObjectId;
  to: string[];
  body: string; // Plain text
}

/**
 * Resolves recipient types to actual email addresses or phone numbers
 */
async function resolveRecipients(
  recipientTypes: string[],
  inspectionId: string | mongoose.Types.ObjectId,
  type: 'email' | 'phone'
): Promise<string[]> {
  const inspection = await Inspection.findById(inspectionId)
    .populate('clients', type === 'email' ? 'email' : 'phone')
    .populate('agents', type === 'email' ? 'email' : 'phone')
    .populate('listingAgent', type === 'email' ? 'email' : 'phone')
    .populate('inspector', type === 'email' ? 'email' : 'phoneNumber')
    .lean();

  if (!inspection) {
    return [];
  }

  const recipients: Set<string> = new Set();

  for (const recipientType of recipientTypes) {
    switch (recipientType) {
      case 'CLIENTS':
        if (inspection.clients && Array.isArray(inspection.clients)) {
          inspection.clients.forEach((client: any) => {
            const contact = type === 'email' ? client.email : client.phone;
            if (contact) recipients.add(contact);
          });
        }
        break;

      case 'CLIENTS_AGENTS':
        if (inspection.agents && Array.isArray(inspection.agents)) {
          inspection.agents.forEach((agent: any) => {
            const contact = type === 'email' ? agent.email : agent.phone;
            if (contact) recipients.add(contact);
          });
        }
        break;

      case 'LISTING_AGENTS':
        if (inspection.listingAgent && Array.isArray(inspection.listingAgent)) {
          inspection.listingAgent.forEach((agent: any) => {
            const contact = type === 'email' ? agent.email : agent.phone;
            if (contact) recipients.add(contact);
          });
        }
        break;

      case 'INSPECTORS':
        if (inspection.inspector) {
          const contact =
            type === 'email'
              ? (inspection.inspector as any).email
              : (inspection.inspector as any).phoneNumber;
          if (contact) recipients.add(contact);
        }
        break;

      default:
        // Assume it's already an email/phone address
        if (recipientType && recipientType.includes(type === 'email' ? '@' : '+')) {
          recipients.add(recipientType);
        }
        break;
    }
  }

  return Array.from(recipients);
}

/**
 * Gets the "from" email address based on the from type
 */
async function getFromEmail(
  from: 'COMPANY' | 'INSPECTOR',
  inspectionId: string | mongoose.Types.ObjectId
): Promise<string> {
  if (from === 'COMPANY') {
    return FROM_EMAIL;
  }

  // Get inspector email
  const inspection = await Inspection.findById(inspectionId)
    .populate('inspector', 'email')
    .lean();

  if (inspection?.inspector && (inspection.inspector as any).email) {
    return (inspection.inspector as any).email;
  }

  // Fallback to company email if inspector email not available
  return FROM_EMAIL;
}

/**
 * Sends an automation email
 */
export async function sendAutomationEmail(params: SendEmailParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Resolve recipients
    const toAddresses = await resolveRecipients(params.to, params.inspectionId, 'email');
    if (toAddresses.length === 0) {
      return {
        success: false,
        error: 'No valid email recipients found',
      };
    }

    const ccAddresses = params.cc
      ? await resolveRecipients(params.cc, params.inspectionId, 'email')
      : [];
    const bccAddresses = params.bcc
      ? await resolveRecipients(params.bcc, params.inspectionId, 'email')
      : [];

    // Replace placeholders
    const subject = await replacePlaceholders(params.subject, params.inspectionId);
    const body = await replacePlaceholders(params.body, params.inspectionId);

    // Get from email
    const fromEmail = await getFromEmail(params.from, params.inspectionId);

    // Send email
    const result = await resend.emails.send({
      from: fromEmail,
      to: toAddresses,
      cc: ccAddresses.length > 0 ? ccAddresses : undefined,
      bcc: bccAddresses.length > 0 ? bccAddresses : undefined,
      subject: subject,
      html: body,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message || 'Failed to send email',
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error sending automation email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Strips HTML from content for SMS
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/&nbsp;/g, ' ') // Replace &nbsp; with space
    .replace(/&amp;/g, '&') // Replace &amp; with &
    .replace(/&lt;/g, '<') // Replace &lt; with <
    .replace(/&gt;/g, '>') // Replace &gt; with >
    .replace(/&quot;/g, '"') // Replace &quot; with "
    .replace(/&#39;/g, "'") // Replace &#39; with '
    .trim();
}

/**
 * Sends an automation SMS
 * Note: This uses Resend's SMS API if available, otherwise may need Twilio or similar
 */
export async function sendAutomationSMS(params: SendSMSParams): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Resolve recipients (phone numbers)
    const phoneNumbers = await resolveRecipients(params.to, params.inspectionId, 'phone');
    if (phoneNumbers.length === 0) {
      return {
        success: false,
        error: 'No valid phone number recipients found',
      };
    }

    // Replace placeholders and strip HTML
    const bodyHtml = await replacePlaceholders(params.body, params.inspectionId);
    const bodyText = stripHtml(bodyHtml);

    // Note: Resend may not have SMS API yet, so this is a placeholder
    // You may need to integrate with Twilio or another SMS provider
    // For now, we'll log that SMS would be sent
    
    console.log('SMS would be sent:', {
      to: phoneNumbers,
      body: bodyText.substring(0, 100) + '...',
    });

    // TODO: Implement actual SMS sending via Resend SMS API or Twilio
    // Example with Resend (if available):
    // const result = await resend.sms.send({
    //   from: process.env.SMS_FROM_NUMBER,
    //   to: phoneNumbers,
    //   message: bodyText,
    // });

    // For now, return success but log that it's not implemented
    console.warn('SMS sending not fully implemented. Please integrate with SMS provider.');

    return {
      success: true,
    };
  } catch (error: any) {
    console.error('Error sending automation SMS:', error);
    return {
      success: false,
      error: error.message || 'Failed to send SMS',
    };
  }
}

