require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const fs = require('fs');

// LOCAL database connection (from .env.local)
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

async function exportLocalDatabase() {
  try {
    console.log('📤 Exporting LOCAL database...\n');
    
    // Connect to LOCAL database
    await mongoose.connect(process.env.MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    const host = mongoose.connection.host;
    
    console.log('✅ Connected to LOCAL MongoDB');
    console.log(`📍 Database: ${dbName}`);
    console.log(`🔗 Host: ${host}\n`);

    // Get ALL checklist items
    const allItems = await SectionChecklist.find().sort({ order_index: 1 }).lean();
    
    console.log(`📊 Found ${allItems.length} checklist items in local database\n`);

    // Create export data with ONLY the fields we need to sync
    const exportData = allItems.map(item => ({
      text: item.text, // This is the unique identifier
      comment: item.comment || '', // Keep comments exactly as they are in local
      answer_choices: item.answer_choices || [], // Keep answer choices
      type: item.type,
      tab: item.tab
    }));

    // Save to JSON file
    fs.writeFileSync(
      'scripts/local-database-export.json',
      JSON.stringify(exportData, null, 2)
    );

    console.log('✅ Exported to: scripts/local-database-export.json');
    
    // Show some stats
    const withComments = exportData.filter(i => i.comment && i.comment.length > 0).length;
    const withAnswers = exportData.filter(i => i.answer_choices && i.answer_choices.length > 0).length;
    
    console.log('\n📊 EXPORT SUMMARY:');
    console.log(`   Total items: ${exportData.length}`);
    console.log(`   Items with comments: ${withComments}`);
    console.log(`   Items with answer_choices: ${withAnswers}`);
    
    // Show first 5 items with comments
    console.log('\n📝 First 5 items WITH comments:');
    const itemsWithComments = exportData.filter(i => i.comment && i.comment.length > 0);
    itemsWithComments.slice(0, 5).forEach((item, idx) => {
      const preview = item.comment.length > 80 
        ? item.comment.substring(0, 80) + '...'
        : item.comment;
      console.log(`${idx + 1}. ${item.text}`);
      console.log(`   "${preview}"\n`);
    });

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

exportLocalDatabase();
