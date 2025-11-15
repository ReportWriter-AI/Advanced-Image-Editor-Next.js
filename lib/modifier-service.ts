import mongoose from 'mongoose';
import ModifierField from '@/src/models/ModifierField';
import { MODIFIER_FIELDS } from '@/constants/modifierOptions';

export async function ensureDefaultModifiersForCompany(
  companyId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
) {
  const existingCount = await ModifierField.countDocuments({ company: companyId });
  if (existingCount > 0) {
    return;
  }

  const docs = MODIFIER_FIELDS.map((field, index) => ({
    key: field.key,
    label: field.label,
    supportsType: field.supportsType,
    hasEqualsField: field.hasEqualsField,
    requiresRange: field.requiresRange,
    group: field.group,
    orderIndex: index + 1,
    company: companyId,
    createdBy: userId,
  }));

  try {
    await ModifierField.insertMany(docs, { ordered: false });
  } catch (error: any) {
    if (error?.code === 11000) {
      return;
    }
    throw error;
  }
}


