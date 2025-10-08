require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

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

async function checkAnswerChoices() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    console.log('✅ Connected to MongoDB\n');

    // Check specific items that should have answer_choices
    const testItems = [
      'General: Type of Inspection',
      'General: Style of Home',
      'General: In Attendance',
      'Electrical - Main Disconnect - Location',
      'Water Heater: Manufacturer'
    ];

    console.log('🔍 Checking if answer_choices exist in database:\n');

    for (const itemText of testItems) {
      const item = await SectionChecklist.findOne({ text: itemText }).lean();
      
      if (item) {
        const hasAnswers = item.answer_choices && item.answer_choices.length > 0;
        console.log(`${hasAnswers ? '✅' : '❌'} ${itemText}`);
        if (hasAnswers) {
          console.log(`   Choices: ${item.answer_choices.slice(0, 3).join(', ')}... (${item.answer_choices.length} total)`);
        } else {
          console.log(`   answer_choices field: ${JSON.stringify(item.answer_choices)}`);
        }
      } else {
        console.log(`⚠️  NOT FOUND: ${itemText}`);
      }
      console.log('');
    }

    // Get summary
    const totalItems = await SectionChecklist.countDocuments();
    const itemsWithAnswers = await SectionChecklist.countDocuments({ 
      answer_choices: { $exists: true, $ne: null, $ne: [] } 
    });

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 DATABASE SUMMARY:');
    console.log(`   Total items: ${totalItems}`);
    console.log(`   Items with answer_choices: ${itemsWithAnswers}`);
    console.log(`   Items without answer_choices: ${totalItems - itemsWithAnswers}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAnswerChoices();
