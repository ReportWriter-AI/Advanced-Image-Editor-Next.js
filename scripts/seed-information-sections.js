#!/usr/bin/env node
/**
 * Seed script for Information Sections feature.
 * Populates: Section, SectionChecklist, SectionComment collections
 * using spectora_report_data.json at project root.
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
  order_index: { type: Number, required: true },
}, { timestamps: true });
sectionChecklistSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const SectionChecklist = mongoose.models.SectionChecklist || mongoose.model('SectionChecklist', sectionChecklistSchema);

const sectionCommentSchema = new mongoose.Schema({
  section_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true, index: true },
  text: { type: String, required: true, trim: true },
  order_index: { type: Number, required: true },
}, { timestamps: true });
sectionCommentSchema.index({ section_id: 1, text: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
const SectionComment = mongoose.models.SectionComment || mongoose.model('SectionComment', sectionCommentSchema);

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
  let commentCount = 0;

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

    // Insert checklists
    if (Array.isArray(s.checklists)) {
      for (let cIdx = 0; cIdx < s.checklists.length; cIdx++) {
        const text = (s.checklists[cIdx] || '').trim();
        if (!text) continue;
        try {
          await SectionChecklist.findOneAndUpdate(
            { section_id: sectionDoc._id, text },
            { section_id: sectionDoc._id, text, order_index: cIdx + 1 },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          checklistCount++;
        } catch (err) {
          console.warn(`Checklist upsert failed (section: ${name}) -> ${text.substring(0,80)}... : ${err.message}`);
        }
      }
    }

    // Insert comments
    if (Array.isArray(s.comments)) {
      for (let cmIdx = 0; cmIdx < s.comments.length; cmIdx++) {
        const text = (s.comments[cmIdx] || '').trim();
        if (!text) continue;
        try {
          await SectionComment.findOneAndUpdate(
            { section_id: sectionDoc._id, text },
            { section_id: sectionDoc._id, text, order_index: cmIdx + 1 },
            { upsert: true, new: true, setDefaultsOnInsert: true }
          );
          commentCount++;
        } catch (err) {
          console.warn(`Comment upsert failed (section: ${name}) -> ${text.substring(0,80)}... : ${err.message}`);
        }
      }
    }

    console.log(`Seeded section [${i + 1}/${data.sections.length}]: "${name}" (checklists: ${s.checklists?.length || 0}, comments: ${s.comments?.length || 0})`);
  }

  console.log('--- Seeding Complete ---');
  console.log(`Sections processed: ${sectionCount}`);
  console.log(`Checklists upserted: ${checklistCount}`);
  console.log(`Comments upserted: ${commentCount}`);

  await mongoose.disconnect();
  console.log('Disconnected from MongoDB.');
}

main().catch(err => {
  console.error('Seeding failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
