require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

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

async function verifyFix() {
  try {
    console.log('🔍 VERIFYING PRODUCTION FIX\n');
    
    await mongoose.connect(PRODUCTION_URI);
    console.log('✅ Connected to PRODUCTION\n');
    
    const Section = mongoose.model('Section', SectionSchema);
    const SectionChecklist = mongoose.model('SectionChecklist', SectionChecklistSchema);
    
    // Get first 3 sections
    const sections = await Section.find().sort({ order_index: 1 }).limit(3).lean();
    
    for (const section of sections) {
      console.log(`📂 Section: ${section.name}`);
      console.log(`   Section ID: ${section._id}`);
      
      // Query items for this section
      const items = await SectionChecklist.find({ section_id: section._id }).limit(5).lean();
      
      console.log(`   📊 Found ${items.length} items (showing first 5):`);
      items.forEach((item, idx) => {
        const hasComment = item.comment ? '📝' : '⚪';
        const hasAnswers = item.answer_choices?.length > 0 ? '✅' : '⚪';
        console.log(`   ${idx + 1}. ${item.text} ${hasComment} ${hasAnswers}`);
      });
      console.log('');
    }
    
    // Count items with answer_choices
    const itemsWithAnswers = await SectionChecklist.countDocuments({ 
      answer_choices: { $exists: true, $ne: [] } 
    });
    
    // Count items with comments
    const itemsWithComments = await SectionChecklist.countDocuments({
      comment: { $exists: true, $ne: '' }
    });
    
    const totalItems = await SectionChecklist.countDocuments();
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 PRODUCTION DATABASE SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Total items: ${totalItems}`);
    console.log(`Items with answer_choices: ${itemsWithAnswers}`);
    console.log(`Items with comments: ${itemsWithComments}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✨ Production database looks good!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

verifyFix();
