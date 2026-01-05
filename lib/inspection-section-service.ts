import mongoose from 'mongoose';
import InspectionSection from '@/src/models/InspectionSection';
import { DEFAULT_INSPECTION_SECTIONS } from '@/constants/defaultInspectionSections';

export async function ensureDefaultInspectionSectionsForCompany(
  companyId: mongoose.Types.ObjectId
) {
  const existingCount = await InspectionSection.countDocuments({ company: companyId });
  if (existingCount > 0) {
    return;
  }

  const docs = DEFAULT_INSPECTION_SECTIONS.map((section) => ({
    company: companyId,
    name: section.name,
    order_index: section.order_index,
    checklists: section.checklists,
  }));

  try {
    await InspectionSection.insertMany(docs, { ordered: false });
  } catch (error: any) {
    if (error?.code === 11000) {
      return;
    }
    throw error;
  }
}

