/**
 * SMART DATABASE COPY: Match by section name + item text
 * This preserves the correct section_id relationships
 */

const mongoose = require('mongoose');
const readline = require('readline');

// LOCAL database URI
require('dotenv').config({ path: '.env.local' });
const LOCAL_MONGODB_URI = process.env.MONGODB_URI;

// VERCEL PRODUCTION URI
const VERCEL_MONGODB_URI = 'mongodb+srv://agottges_db_user:ibnnjPxUR7ueo9ov@agi-property-inspection.6e3skrc.mongodb.net/agi-inspections?retryWrites=true&w=majority&appName=agi-property-inspection';

// Schemas
const SectionSchema = new mongoose.Schema({
  name: String,
  order_index: Number
}, { collection: 'sections', timestamps: true });

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

async function smartCopy() {
  try {
    console.log('🔄 SMART DATABASE COPY: LOCAL → PRODUCTION\n');
    
    // Step 1: Connect to LOCAL and get all data with section names
    console.log('📤 Step 1: Reading LOCAL database...');
    const localConn = await mongoose.createConnection(LOCAL_MONGODB_URI).asPromise();
    const LocalSection = localConn.model('Section', SectionSchema);
    const LocalChecklist = localConn.model('SectionChecklist', SectionChecklistSchema);
    
    const localSections = await LocalSection.find().lean();
    const localChecklists = await LocalChecklist.find().lean();
    
    // Create a map of section_id to section name
    const localSectionMap = {};
    localSections.forEach(s => {
      localSectionMap[s._id.toString()] = s.name;
    });
    
    // Create data structure: section name → items
    const dataBySection = {};
    localChecklists.forEach(item => {
      const sectionName = localSectionMap[item.section_id.toString()];
      if (!dataBySection[sectionName]) {
        dataBySection[sectionName] = [];
      }
      dataBySection[sectionName].push({
        text: item.text,
        comment: item.comment || '',
        answer_choices: item.answer_choices || [],
        type: item.type,
        tab: item.tab,
        order_index: item.order_index
      });
    });
    
    console.log(`✅ Loaded ${localChecklists.length} items from ${localSections.length} sections\n`);
    await localConn.close();
    
    // Step 2: Connect to PRODUCTION
    console.log('📥 Step 2: Connecting to PRODUCTION...');
    const prodConn = await mongoose.createConnection(VERCEL_MONGODB_URI).asPromise();
    const ProdSection = prodConn.model('Section', SectionSchema);
    const ProdChecklist = prodConn.model('SectionChecklist', SectionChecklistSchema);
    
    const prodSections = await ProdSection.find().lean();
    console.log(`✅ Found ${prodSections.length} sections in production\n`);
    
    // Create production section name → _id map
    const prodSectionMap = {};
    prodSections.forEach(s => {
      prodSectionMap[s.name] = s._id;
    });
    
    // Safety confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  Update production items with LOCAL data? (yes/no):', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Copy cancelled');
      await prodConn.close();
      process.exit(0);
    }

    // Step 3: Update each production item
    console.log('\n🔄 Updating production items...\n');
    
    let updated = 0;
    let notFound = 0;
    
    for (const [sectionName, items] of Object.entries(dataBySection)) {
      const prodSectionId = prodSectionMap[sectionName];
      
      if (!prodSectionId) {
        console.log(`⚠️  Section not found in production: ${sectionName}`);
        continue;
      }
      
      console.log(`📂 Processing: ${sectionName}`);
      
      for (const itemData of items) {
        // Find the production item by section_id and text
        const prodItem = await ProdChecklist.findOne({
          section_id: prodSectionId,
          text: itemData.text
        });
        
        if (prodItem) {
          // Update with local data
          await ProdChecklist.findByIdAndUpdate(
            prodItem._id,
            {
              comment: itemData.comment,
              answer_choices: itemData.answer_choices,
              type: itemData.type,
              tab: itemData.tab,
              order_index: itemData.order_index
            }
          );
          
          const hasAnswers = itemData.answer_choices && itemData.answer_choices.length > 0;
          const status = hasAnswers ? '✅' : '⚪';
          console.log(`   ${status} ${itemData.text}`);
          updated++;
        } else {
          console.log(`   ⚠️  Not found: ${itemData.text}`);
          notFound++;
        }
      }
      console.log('');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Items updated: ${updated}`);
    console.log(`⚠️  Items not found: ${notFound}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✨ Production updated with LOCAL data!\n');
    
    await prodConn.close();
    console.log('🔌 Disconnected');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

smartCopy();
