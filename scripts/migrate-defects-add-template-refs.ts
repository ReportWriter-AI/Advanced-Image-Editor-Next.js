/**
 * Migration Script: Add template/section/subsection references to existing defects
 * 
 * This script handles existing defects that don't have templateId, sectionId, or subsectionId.
 * These fields are now optional in the model, but this script can help populate them for
 * better organization in reports.
 * 
 * Run this script with: npx tsx scripts/migrate-defects-add-template-refs.ts
 */

import mongoose from 'mongoose';
import Defect from '../src/models/Defect';
import dbConnect from '../lib/db';

async function migrateDefects() {
  try {
    console.log('🚀 Starting defect migration...');
    
    // Connect to database
    await dbConnect();
    console.log('✅ Connected to database');

    // Find all defects without template/section/subsection IDs
    const defectsWithoutRefs = await Defect.find({
      $or: [
        { templateId: { $exists: false } },
        { sectionId: { $exists: false } },
        { subsectionId: { $exists: false } },
      ]
    });

    console.log(`📊 Found ${defectsWithoutRefs.length} defects without template/section/subsection references`);

    if (defectsWithoutRefs.length === 0) {
      console.log('✅ No defects need migration. All defects have the required fields.');
      return;
    }

    // Option 1: Set these fields to null (they're optional now)
    // This marks them as "inspection-level" defects not tied to specific report subsections
    const result = await Defect.updateMany(
      {
        $or: [
          { templateId: { $exists: false } },
          { sectionId: { $exists: false } },
          { subsectionId: { $exists: false } },
        ]
      },
      {
        $set: {
          templateId: null,
          sectionId: null,
          subsectionId: null,
        }
      }
    );

    console.log(`✅ Migration completed successfully!`);
    console.log(`   - Matched: ${result.matchedCount}`);
    console.log(`   - Modified: ${result.modifiedCount}`);
    console.log('');
    console.log('ℹ️  Note: These defects are now marked as inspection-level defects.');
    console.log('   They will appear in the inspection edit page but not in report subsections.');
    console.log('   To assign them to specific subsections, edit them manually in the app.');

    // Close connection
    await mongoose.connection.close();
    console.log('👋 Database connection closed');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
migrateDefects()
  .then(() => {
    console.log('🎉 Migration script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
