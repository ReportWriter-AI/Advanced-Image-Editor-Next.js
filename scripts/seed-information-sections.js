#!/usr/bin/env node
/**
 * Seed script for Information Sections feature.
 * Populates: Section, SectionChecklist collections
 * using spectora_report_data.json at project root.
 * Comments are now embedded within checklists.
 */

require('dotenv').config({ path: '.env.local' });
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// Mongoose Models - lightweight schemas for seeding
const sectionSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  order_index: { type: Number, required: true, index: true },
}, { timestamps: true });
sectionSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const Section = mongoose.models.Section || mongoose.model('Section', sectionSchema);

const sectionChecklistSchema = new mongoose.Schema({
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  text: { type: String, required: true, trim: true },
  comment: { type: String, trim: true },
  type: { type: String, enum: ['status', 'information'], required: true, default: 'information' },
  order_index: { type: Number, required: true },
}, { timestamps: true });
sectionChecklistSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const SectionChecklist = mongoose.models.SectionChecklist || mongoose.model('SectionChecklist', sectionChecklistSchema);

/**
 * Classify checklist item as 'status' or 'information' based on text content
 */
function classifyChecklistType(text) {
  const textLower = text.toLowerCase();
  
  // Status items - items that show in the 3-column grid
  const statusKeywords = [
    ': ok',
    ': material',
    ': style',
    ': type',
    ': method',
    ': location',
    ': floor',
    ': wall',
    ': ceiling',
    ': structure',
    ': floor coverings',
    ': cabinetry material',
    ': countertop material',
    ': sheathing material',
    ': in attendance',
    ': occupancy',
    ': utilities',
    ': weather',
    ': exterior temperature',
    ': inspection categories'
  ];
  
  for (const keyword of statusKeywords) {
    if (textLower.includes(keyword)) {
      return 'status';
    }
  }
  
  // Information items - items that show in blue information box with explanations
  const informationKeywords = [
    'limitation',
    'disclaimer',
    'information',
    'important',
    'inspection',
    'unable to',
    'inaccessible',
    'excluded',
    'incomplete',
    'staged',
    'occupied',
    'recommendations',
    'shut off',
    'shutoff',
    'main disconnect',
    'images of each room'
  ];
  
  for (const keyword of informationKeywords) {
    if (textLower.includes(keyword)) {
      return 'information';
    }
  }
  
  // Default to information type
  return 'information';
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('MONGODB_URI not found in environment (.env.local)');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri, { autoIndex: true });
  console.log('Connected.');

  const jsonPath = path.resolve(process.cwd(), 'spectora_report_data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('spectora_report_data.json not found at project root:', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf-8');
  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse spectora_report_data.json:', e.message);
    process.exit(1);
  }

  if (!data.sections || !Array.isArray(data.sections)) {
    console.error('Invalid JSON structure: missing sections array');
    process.exit(1);
  }

  console.log(`Found ${data.sections.length} sections in JSON.`);

  let sectionCount = 0;
  let checklistCount = 0;

  for (let i = 0; i < data.sections.length; i++) {
    const s = data.sections[i];
    const name = s.name?.trim();
    if (!name) {
      console.warn(`Skipping unnamed section at index ${i}`);
      continue;
    }

    // Upsert section (idempotent)
    let sectionDoc = await Section.findOneAndUpdate(
      { name },
      { name, order_index: i + 1 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    sectionCount++;

    // Insert checklists with embedded comments
    // Comments array is parallel to checklists array - same index means they go together
    if (Array.isArray(s.checklists)) {
      for (let cIdx = 0; cIdx < s.checklists.length; cIdx++) {
        const text = (s.checklists[cIdx] || '').trim();
        if (!text) continue;
        
        // Get corresponding comment at same index (if available)
        const comment = Array.isArray(s.comments) && s.comments[cIdx] 
          ? (s.comments[cIdx] || '').trim() 
          : undefined;
        
        // Classify the checklist item
        const type = classifyChecklistType(text);
        
        try {
          await SectionChecklist.findOneAndUpdate(
            { section_id: sectionDoc._id, text },
            { 
              section_id: sectionDoc._id, 
              text, 
              comment: comment || undefined,
              type: type,
              order_index: cIdx + 1 
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          checklistCount++;
        } catch (err) {
          console.warn(`Checklist upsert failed (section: ${name}) -> ${text.substring(0,80)}... : ${err.message}`);
        }
      }
    }

    const commentsEmbedded = Array.isArray(s.checklists) && Array.isArray(s.comments) 
      ? Math.min(s.checklists.length, s.comments.length)
      : 0;
    
    console.log(`Seeded section [${i + 1}/${data.sections.length}]: "${name}" (checklists: ${s.checklists?.length || 0}, comments embedded: ${commentsEmbedded})`);
  }

  console.log('--- Seeding Complete ---');
  console.log(`Sections processed: ${sectionCount}`);
  console.log(`Checklists upserted: ${checklistCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(err => {
  console.error('Seeding failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
