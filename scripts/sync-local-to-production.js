/**
 * Sync LOCAL database to VERCEL PRODUCTION
 * This will make production EXACTLY like local
 */

const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs');

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

async function syncToProduction() {
  try {
    console.log('🔄 Syncing LOCAL database to VERCEL PRODUCTION...\n');
    
    // Read exported data
    const exportData = JSON.parse(
      fs.readFileSync('scripts/local-database-export.json', 'utf8')
    );
    
    console.log(`📂 Loaded ${exportData.length} items from local export\n`);
    
    // Connect to VERCEL PRODUCTION
    await mongoose.connect(VERCEL_MONGODB_URI);
    const dbName = mongoose.connection.db.databaseName;
    const host = mongoose.connection.host;
    
    console.log('✅ Connected to VERCEL PRODUCTION MongoDB');
    console.log(`📍 Database: ${dbName}`);
    console.log(`🔗 Host: ${host}\n`);

    // Safety confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  This will UPDATE production to match LOCAL exactly. Continue? (yes/no):', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Sync cancelled');
      process.exit(0);
    }

    let updated = 0;
    let skipped = 0;

    console.log('\n🔄 Syncing items...\n');

    // Update each item
    for (const localItem of exportData) {
      const productionItem = await SectionChecklist.findOne({ text: localItem.text });
      
      if (productionItem) {
        // Update with LOCAL data
        await SectionChecklist.findByIdAndUpdate(
          productionItem._id,
          {
            comment: localItem.comment || '',
            answer_choices: localItem.answer_choices || [],
            type: localItem.type,
            tab: localItem.tab
          },
          { new: true }
        );
        
        const hasComment = localItem.comment && localItem.comment.length > 0;
        const hasAnswers = localItem.answer_choices && localItem.answer_choices.length > 0;
        
        let status = '';
        if (hasComment && hasAnswers) status = '📝✅';
        else if (hasComment) status = '📝';
        else if (hasAnswers) status = '✅';
        else status = '⚪';
        
        console.log(`   ${status} ${localItem.text}`);
        updated++;
      } else {
        console.log(`   ⚠️  NOT FOUND: ${localItem.text}`);
        skipped++;
      }
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SYNC SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Items synced: ${updated}`);
    console.log(`⚠️  Items not found: ${skipped}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log('✨ Production now matches LOCAL exactly!\n');

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

syncToProduction();
