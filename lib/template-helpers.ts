import mongoose from 'mongoose';
import Template from '@/src/models/Template';
import { ITemplate } from '@/src/models/Template';

/**
 * Gets an authorized template (not deleted) for a given template ID and company.
 * Returns null if template doesn't exist, doesn't belong to company, or is deleted.
 * 
 * @param templateId - The template ID
 * @param userCompanyId - The user's company ID (optional)
 * @param lean - Whether to return a plain object (lean) or Mongoose document (default: false)
 * @returns The template document or null
 */
export async function getAuthorizedTemplate(
  templateId: string,
  userCompanyId?: mongoose.Types.ObjectId,
  lean: boolean = false
): Promise<ITemplate | null> {
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return null;
  }

  if (lean) {
    const template = await Template.findById(templateId).lean();

    if (!template) {
      return null;
    }

    const templateDoc = template as any;

    if (userCompanyId && templateDoc.company.toString() !== userCompanyId.toString()) {
      return null;
    }

    if (templateDoc.deletedAt) {
      return null;
    }

    return templateDoc;
  } else {
    const template = await Template.findById(templateId);

    if (!template) {
      return null;
    }

    if (userCompanyId && template.company.toString() !== userCompanyId.toString()) {
      return null;
    }

    if (template.deletedAt) {
      return null;
    }

    return template;
  }
}
