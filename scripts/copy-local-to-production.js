/**
 * COMPLETE DATABASE COPY: LOCAL → PRODUCTION
 * This will DELETE all production data and replace it with local data
 */

const mongoose = require('mongoose');
const readline = require('readline');
const fs = require('fs');

// LOCAL database URI (from .env.local)
require('dotenv').config({ path: '.env.local' });
const LOCAL_MONGODB_URI = process.env.MONGODB_URI;

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

async function copyDatabase() {
  try {
    console.log('🔄 COMPLETE DATABASE COPY: LOCAL → PRODUCTION\n');
    
    // Step 1: Connect to LOCAL and export ALL data
    console.log('📤 Step 1: Connecting to LOCAL database...');
    const localConn = await mongoose.createConnection(LOCAL_MONGODB_URI).asPromise();
    const LocalChecklist = localConn.model('SectionChecklist', SectionChecklistSchema);
    
    console.log(`✅ Connected to LOCAL: ${localConn.db.databaseName}`);
    console.log(`   Host: ${localConn.host}\n`);
    
    const localData = await LocalChecklist.find().lean();
    console.log(`📊 Found ${localData.length} items in LOCAL database\n`);
    
    await localConn.close();
    console.log('✅ Exported from LOCAL\n');
    
    // Step 2: Connect to PRODUCTION
    console.log('📥 Step 2: Connecting to PRODUCTION database...');
    const prodConn = await mongoose.createConnection(VERCEL_MONGODB_URI).asPromise();
    const ProdChecklist = prodConn.model('SectionChecklist', SectionChecklistSchema);
    
    console.log(`✅ Connected to PRODUCTION: ${prodConn.db.databaseName}`);
    console.log(`   Host: ${prodConn.host}\n`);
    
    // Safety confirmation
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  This will DELETE ALL production data and replace with LOCAL. Continue? (yes/no):', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Copy cancelled');
      await prodConn.close();
      process.exit(0);
    }

    // Step 3: Delete all production data
    console.log('\n🗑️  Step 3: Deleting ALL production data...');
    const deleteResult = await ProdChecklist.deleteMany({});
    console.log(`✅ Deleted ${deleteResult.deletedCount} items from production\n`);
    
    // Step 4: Insert local data into production
    console.log('💾 Step 4: Copying LOCAL data to PRODUCTION...');
    
    // Remove _id fields to let MongoDB generate new ones
    const dataToInsert = localData.map(item => {
      const { _id, ...rest } = item;
      return rest;
    });
    
    const insertResult = await ProdChecklist.insertMany(dataToInsert);
    console.log(`✅ Inserted ${insertResult.length} items into production\n`);
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 COPY SUMMARY');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🗑️  Deleted from production: ${deleteResult.deletedCount}`);
    console.log(`💾 Copied from local: ${insertResult.length}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('✨ Production database is now IDENTICAL to LOCAL!\n');
    
    await prodConn.close();
    console.log('🔌 Disconnected from databases');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyDatabase();
