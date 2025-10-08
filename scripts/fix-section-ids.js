require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

const LOCAL_URI = process.env.MONGODB_URI;
const PRODUCTION_URI = 'mongodb+srv://agottges_db_user:ibnnjPxUR7ueo9ov@agi-property-inspection.6e3skrc.mongodb.net/agi-inspections?retryWrites=true&w=majority&appName=agi-property-inspection';

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

async function fixSectionIds() {
  let localConn, prodConn;
  
  try {
    console.log('🔄 FIX SECTION IDS IN PRODUCTION\n');
    
    // Step 1: Connect to LOCAL and get section mappings
    console.log('📤 Step 1: Connecting to LOCAL database...');
    localConn = await mongoose.createConnection(LOCAL_URI).asPromise();
    console.log('✅ Connected to LOCAL');
    
    const LocalSection = localConn.model('Section', SectionSchema);
    const LocalChecklist = localConn.model('SectionChecklist', SectionChecklistSchema);
    
    const localSections = await LocalSection.find().lean();
    console.log(`📊 Found ${localSections.length} sections in LOCAL`);
    
    // Create mapping: local section_id → section name
    const localSectionIdToName = new Map();
    localSections.forEach(section => {
      localSectionIdToName.set(section._id.toString(), section.name);
    });
    
    // Step 2: Connect to PRODUCTION
    console.log('\n📥 Step 2: Connecting to PRODUCTION database...');
    prodConn = await mongoose.createConnection(PRODUCTION_URI).asPromise();
    console.log('✅ Connected to PRODUCTION');
    
    const ProdSection = prodConn.model('Section', SectionSchema);
    const ProdChecklist = prodConn.model('SectionChecklist', SectionChecklistSchema);
    
    const prodSections = await ProdSection.find().lean();
    console.log(`📊 Found ${prodSections.length} sections in PRODUCTION`);
    
    // Create mapping: section name → production section_id
    const prodSectionNameToId = new Map();
    prodSections.forEach(section => {
      prodSectionNameToId.set(section.name, section._id.toString());
    });
    
    // Step 3: Get all production items
    console.log('\n🔍 Step 3: Analyzing production items...');
    const prodItems = await ProdChecklist.find().lean();
    console.log(`📊 Found ${prodItems.length} items in PRODUCTION`);
    
    // Step 4: Update section_ids
    console.log('\n🔄 Step 4: Fixing section_ids...');
    
    let updated = 0;
    let notFound = 0;
    let errors = 0;
    
    for (const item of prodItems) {
      const currentSectionId = item.section_id.toString();
      
      // Find the section name from local mapping
      const sectionName = localSectionIdToName.get(currentSectionId);
      
      if (!sectionName) {
        console.log(`⚠️  Item "${item.text}" has unknown section_id: ${currentSectionId}`);
        notFound++;
        continue;
      }
      
      // Find the correct production section_id
      const correctSectionId = prodSectionNameToId.get(sectionName);
      
      if (!correctSectionId) {
        console.log(`⚠️  Section "${sectionName}" not found in production`);
        notFound++;
        continue;
      }
      
      // Skip if already correct
      if (currentSectionId === correctSectionId) {
        continue;
      }
      
      // Update the item
      try {
        await ProdChecklist.updateOne(
          { _id: item._id },
          { $set: { section_id: correctSectionId } }
        );
        updated++;
        
        if (updated % 50 === 0) {
          console.log(`   ✅ Updated ${updated} items...`);
        }
      } catch (err) {
        console.log(`   ❌ Error updating item "${item.text}": ${err.message}`);
        errors++;
      }
    }
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Items updated: ${updated}`);
    console.log(`⚠️  Items not found: ${notFound}`);
    console.log(`❌ Errors: ${errors}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✨ Section IDs have been fixed in production!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    if (localConn) await localConn.close();
    if (prodConn) await prodConn.close();
    console.log('\n🔌 Disconnected');
  }
}

fixSectionIds();
