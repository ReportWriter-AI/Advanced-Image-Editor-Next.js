import mongoose from 'mongoose';
import Category from '@/src/models/Category';

/**
 * Get or create categories from category names
 * @param categoryNames Array of category names (strings)
 * @param companyId Company ObjectId
 * @param userId User ObjectId (for createdBy field)
 * @returns Promise<ObjectId[]> Array of category ObjectIds
 */
export async function getOrCreateCategories(
  categoryNames: (string | mongoose.Types.ObjectId)[],
  companyId: mongoose.Types.ObjectId,
  userId: mongoose.Types.ObjectId
): Promise<mongoose.Types.ObjectId[]> {
  if (!Array.isArray(categoryNames) || categoryNames.length === 0) {
    return [];
  }

  const categoryIds: mongoose.Types.ObjectId[] = [];
  const processedNames = new Set<string>();

  for (const item of categoryNames) {
    // Handle ObjectId (backward compatibility)
    if (mongoose.Types.ObjectId.isValid(item) && typeof item !== 'string') {
      categoryIds.push(item as mongoose.Types.ObjectId);
      continue;
    }

    // Handle string category names
    if (typeof item !== 'string') {
      continue;
    }

    const trimmedName = item.trim();

    // Skip empty strings or whitespace-only strings
    if (!trimmedName) {
      continue;
    }

    // Deduplicate: skip if we've already processed this name (case-sensitive)
    if (processedNames.has(trimmedName)) {
      continue;
    }

    processedNames.add(trimmedName);

    try {
      // Find existing category by name and company (case-sensitive match)
      let category = await Category.findOne({
        name: trimmedName,
        company: companyId,
      });

      // Create category if it doesn't exist
      if (!category) {
        category = await Category.create({
          name: trimmedName,
          color: '#3b82f6',
          company: companyId,
          createdBy: userId,
          autoCategorizing: false,
          rules: [],
          removeCategoryOnRuleFail: false,
        });
      }

      categoryIds.push(category._id as mongoose.Types.ObjectId);
    } catch (error: any) {
      // Log error but continue processing other categories
      console.error(`Error processing category "${trimmedName}":`, error);
      // If it's a duplicate key error, try to find the existing category
      if (error.code === 11000) {
        const existingCategory = await Category.findOne({
          name: trimmedName,
          company: companyId,
        });
        if (existingCategory) {
          categoryIds.push(existingCategory._id as mongoose.Types.ObjectId);
        }
      }
    }
  }

  return categoryIds;
}

