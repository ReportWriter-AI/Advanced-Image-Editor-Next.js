/**
 * Clean up unnecessary comment text from Vercel production database
 */

const mongoose = require('mongoose');
const readline = require('readline');

// VERCEL PRODUCTION URI
const VERCEL_MONGODB_URI = 'mongodb+srv://agottges_db_user:ibnnjPxUR7ueo9ov@agi-property-inspection.6e3skrc.mongodb.net/agi-inspections?retryWrites=true&w=majority&appName=agi-property-inspection';

// Schema
const SectionChecklistSchema = new mongoose.Schema({
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
  text: String,
  value: String,
  comment: String,
  type: String,
  tab: String,
  answer_choices: [String],
  order_index: Number
}, { collection: 'sectionchecklists', timestamps: true });

const SectionChecklist = mongoose.model('SectionChecklist', SectionChecklistSchema);

async function cleanComments() {
  try {
    console.log('🚀 Cleaning up comments in Vercel production database...\n');
    
    await mongoose.connect(VERCEL_MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    const host = mongoose.connection.host;
    
    console.log('✅ Connected to MongoDB');
    console.log(`📍 Database: ${dbName}`);
    console.log(`🔗 Host: ${host}\n`);

    // Safety confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  This will CLEAR all comment text from checklist items. Continue? (yes/no):', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled');
      process.exit(0);
    }

    // Find all items with comments
    const itemsWithComments = await SectionChecklist.find({ 
      comment: { $exists: true, $ne: null, $ne: '' } 
    });

    console.log(`\n📋 Found ${itemsWithComments.length} items with comments\n`);

    if (itemsWithComments.length === 0) {
      console.log('✅ No comments to clean');
      await mongoose.disconnect();
      return;
    }

    // Show first few items
    console.log('First 5 items with comments:');
    itemsWithComments.slice(0, 5).forEach((item, idx) => {
      const preview = item.comment.length > 100 
        ? item.comment.substring(0, 100) + '...'
        : item.comment;
      console.log(`${idx + 1}. ${item.text}`);
      console.log(`   Comment: "${preview}"\n`);
    });

    // Confirm again
    const rl2 = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const confirm = await new Promise(resolve => {
      rl2.question('⚠️  Clear all these comments? (yes/no):', resolve);
    });
    rl2.close();

    if (confirm.toLowerCase() !== 'yes') {
      console.log('❌ Cleanup cancelled');
      await mongoose.disconnect();
      process.exit(0);
    }

    // Clear all comments
    const result = await SectionChecklist.updateMany(
      { comment: { $exists: true, $ne: null, $ne: '' } },
      { $set: { comment: '' } }
    );

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Comments cleared: ${result.modifiedCount}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Cleanup complete!\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

cleanComments();
