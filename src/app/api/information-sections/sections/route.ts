import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import Section from '@/src/models/Section';
import SectionChecklist from '@/src/models/SectionChecklist';

const RESOURCES_SECTION_NAME = '18 - Resources and Disclaimers';
const LEGACY_RESOURCES_SECTION_NAME = 'Resources and Disclaimers';

const RESOURCES_CHECKLISTS = [
  {
    text: 'General: Final Checklist',
    order_index: 10,
    comment: [
      'Our goal is to treat every home with respect and leave them in the same condition as when we arrived. The following are steps taken as part of our final checklist to ensure that everything was reset to its original position/condition.',
      '',
      '- All Interior and Exterior Lights Are Off',
      '- All Accessible GFCI Receptacles Were Reset',
      '- All Gates Were Closed on The Fence',
      '- Dishwasher Was Finished and Off',
      '- Oven/Range/Cooktops Turned Off',
      '- Thermostat Was Reset to Original Position',
      '- All Exterior Doors and Windows Are Locked',
    ].join('\n'),
  },
  {
    text: 'General: Post Inspection',
    order_index: 20,
    comment: [
      'The "Final Walk-Through" prior to closing is the time for you to go back to the property to ensure there aren\'t any major changes. Conditions can change between the time of a home inspection and the time of closing. Restrictions that existed during the inspection may have been removed for the walk-through, which could expose issues that weren\'t visible the day of the inspection. The following are recommendations of things you can check during your final walkthrough:',
      '',
      '1. Check the heating and cooling system. Turn the thermostat to heat mode and turn the temperature setting up. Confirm that the heating system is running and making heat. Turn the thermostat to cool mode and turn the temperature setting down. Confirm the condenser fan (outside equipment) is spinning and the system is making cool air.',
      '2. Operate all appliances; oven/stove, dishwasher, microwave, etc.',
      '3. Run the water at all plumbing fixtures, both inside and outside, and flush toilets.',
      '4. Operate all exterior doors, windows and locks. Sudden change of functionality with any of these could indicate serious issues, like foundation movement.',
      '5. Test smoke/carbon monoxide detectors, following the manufacturer\'s instructions. Only their presence or absence is reported on. We always recommend you replace them, unless they are clearly only a few years old or the seller can specifically say when they were installed.',
      '6. Ask for all remote controls to any garage door openers, fans, gas fireplaces, etc. so that you can ensure that they work before your last opportunity to have them correct that.',
      '7. Inspect areas that may have been restricted or covered at the time of the inspection. There are videos in your report of any such restriction present at the time of the inspection.',
      '8. Ask sellers about warranties for major building systems, security codes, smart equipment, etc.',
      '9. Ask seller about any warranties that may be transferable or subscriptions like pool, pest control, security.',
    ].join('\n'),
  },
  {
    text: 'General: Inspections Disclaimer',
    order_index: 30,
    comment: [
      'The home inspection report (Report) was prepared by AGI: Property Inspections (AGI) for the specific purposes of assessing the general condition of the building and identifying defects that are readily apparent at the time of inspection based on the limited visual, non-invasive inspection as further described below in the Scope and Limitations & Exclusions sections. No responsibility is accepted if the Report is used for any other purpose, by any other parties, than the client in this inspection.',
      '',
      'Scope',
      'The Report is based on a limited visual, above-ground, non-invasive inspection of the standard systems and components of the building. AGI does not open up, uncover or dismantle any part of the building as part of the inspection or undertake any internal assessment of the building, aside from the electrical panel dead front.',
      '',
      'Report Limitations & Exclusions',
      'The Report is an evaluation only and not a guarantee or warranty as to the state of the building or any product, system, or feature in the building.',
      '',
      'AGI accepts no responsibility or liability for any omission in its inspection or the Report related to defects or irregularities which are not reasonably visible at the time of the inspection or which relate to components of the building:',
      '',
      '1. which are below ground or which are concealed or closed in behind finished surfaces (such as plumbing, drainage, heating, framing, ventilation, insulation, or wiring);',
      '2. which required the moving of anything that impeded access or limited visibility (such as floor coverings, furniture, appliances, personal property, vehicles, vegetation, debris, or soil). AGI does not move owner/occupier items for the inspection, to which access is not readily accessible. This may also include roofs, subfloors, ceiling cavities, and high, constricted, or dangerous areas, for which dangerous, hazardous, or adverse situations are possible.',
      '',
      'In addition, the customer understands and accepts that it\'s possible that AGI will not find some defects because the defect may only occur intermittently or the defect has been deliberately concealed. If you believe that any of these circumstances apply, you should immediately contact AGI to try and resolve them.',
      '',
      'Any area, system, item, or component of the building not explicitly identified in the Report as having been inspected was not included in the scope of the inspection. This consists of the condition and location of any special features or services, underground services drainage, or any systems including electrical, plumbing, gas, or heating except as otherwise may be described in the Report.',
      '',
      'Descriptions in the Report of systems or appliances relate to the existence of such systems or appliances only and not the adequacy, efficiency, or life expectancy of such systems or appliances.',
      '',
      'The Report',
      'is not a structural survey, engineer\'s report, or weather tightness inspection; does not assess compliance with the requirements of any legislation (including any act, regulation, code, or by-law) unless otherwise stated; is not a geotechnical, site or environmental report. AGI makes no representation as to the existence or absence of any hazard (as defined in the Health and Safety in Employment Act) or any hazardous substance, natural hazard, or contaminant (as those terms are defined in the Resource Management Act) in the building or property.',
      '',
      'AGI has not undertaken any title search and assumes all improvements are within the legal boundaries of the property.',
      '',
      'No property survey or any search of the information held by the territorial authority or any other relevant authority has been undertaken. It is recommended that the customer conducts its own Land Information Memorandum or Council property file search.',
      '',
      'Unit Title Properties',
      'If the property is a Unit Title property, the inspection and Report are limited to the actual unit and any accessory unit(s) and do not extend to the remainder of the building or the common areas.',
      '',
      'AGI recommends the customer obtain a copy of the financial statements and minutes from meetings of the Body Corporate to establish the history of the inspected property under such Body Corporate.',
      '',
      'Responsibility to Third Parties',
      'Our responsibility in connection with this Report is limited to the client to whom the Report is addressed and to that client only. We disclaim all responsibility and will accept no liability to any other party without first obtaining the written consent of AGI and the author of the Report.',
      '',
      'AGI reserves the right to alter, amend, explain, or limit any information given to any other party.',
      '',
      'Publication',
      'Neither the whole nor any part of the Report (or any other report provided by AGI, whether written or verbal) may be published or included in any published document, circular, or statement whether in hard copy or electronic form or otherwise disseminated or sold without the prior written approval of AGI and the inspector.',
      '',
      'Claims & Disputes',
      'Should any dispute arise as a result of the inspection or the Report, it must be submitted to AGI in writing as soon as practically possible but in any case, within ten working days of discovery. The customer agrees that in the event of a dispute, the Report\'s contents may not be used to satisfy any terms of a sale and purchase agreement until the dispute/dispute has been resolved. In the event the customer nevertheless enters into an unconditional agreement for the purchase of the subject property or makes an existing agreement unconditional before the resolution of the dispute, the customer shall be deemed to have waived the customer\'s rights to continue with and/or make any future claim against AGI in relation to that matter.',
      '',
      'Any claim relating to the accuracy of the Report, in the form of errors or omissions, is limited to the failure on the part of AGI to follow the Standards of Practice promulgated by the Louisiana State Board of Home Inspectors (a copy is made available for viewing along with the Pre-Inspection Agreement).',
      '',
      'Except in the case of an emergency, the customer further agrees not to disturb, repair, replace, or alter anything that may constitute evidence relating to the dispute or claimed discrepancy before AGI has had an opportunity to re-inspect and investigate the claim. The Client understands and agrees that any failure to notify AGI or permit AGI to re-inspect as stated above shall be deemed a waiver of the customer\'s rights to continue with and/or make any future claim against AGI about that matter.',
      '',
      'Limitation of Liability',
      'The customer acknowledges and agrees that the director(s) and employee(s) of AGI shall not be held liable to the client.',
      '',
      'AGI shall have no liability to the client for any indirect or consequential loss suffered by the client or any other person. The client indemnifies AGI concerning any claims concerning any such loss.',
      '',
      'Subject to any legal provisions, if AGI becomes liable to the customer for any reason, for any loss, damage, harm, or injury in any way connected to the inspection and/or the Report, AGI\'s total liability shall be limited to a sum not exceeding the original fee of the home inspection.',
      '',
      'Consumer Guarantees Act',
      'Nothing contained in these terms and conditions shall be deemed to exclude or restrict any rights or remedies that the client may have under the Consumer Guarantees Act 1993 or otherwise at law.',
      '',
      'Partial Invalidity',
      'If any provision in these terms and conditions is illegal, invalid, or unenforceable, such provision shall be deemed to be excluded or read down to the extent necessary to make the provision legal, valid, or enforceable, and the remaining provisions of these terms and conditions shall not be affected.',
    ].join('\n'),
  },
];

async function dbConnect() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI!);
  }
}

export async function GET() {
  try {
    await dbConnect();
    await ensureResourcesSection();

    // Fetch all sections sorted by order_index
    const sections = await Section.find({}).sort({ order_index: 1 }).lean();
    
    if (!sections.length) {
      return NextResponse.json({ success: true, data: [] });
    }

    const sectionIds = sections.map(s => s._id);

    // Fetch all checklists for these sections (comments are now embedded)
    const checklists = await SectionChecklist.find({ section_id: { $in: sectionIds } }).lean();

    // Group checklists by section_id
    const checklistMap: Record<string, any[]> = {};
    for (const cl of checklists) {
      const key = cl.section_id.toString();
      if (!checklistMap[key]) checklistMap[key] = [];
      checklistMap[key].push(cl);
    }

    // Combine sections with their nested data
    const result = sections.map(section => ({
      ...section,
      checklists: (checklistMap[section._id.toString()] || []).sort((a, b) => a.order_index - b.order_index),
    }));

    // Ensure no caching in production to always get fresh section/checklist data
    return NextResponse.json(
      { success: true, data: result },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (err: any) {
    console.error('GET /api/information-sections/sections error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

async function ensureResourcesSection() {
  let section = await Section.findOne({ name: RESOURCES_SECTION_NAME });

  if (!section) {
    const legacySection = await Section.findOne({ name: LEGACY_RESOURCES_SECTION_NAME });
    if (legacySection) {
      legacySection.name = RESOURCES_SECTION_NAME;
      await legacySection.save();
      section = legacySection;
    }
  }

  if (!section) {
    const lastSection = await Section.findOne({}).sort({ order_index: -1 }).select('order_index').lean();
    const orderIndex = lastSection ? lastSection.order_index + 1 : 0;
    section = await Section.create({
      name: RESOURCES_SECTION_NAME,
      order_index: orderIndex,
    });

    for (const item of RESOURCES_CHECKLISTS) {
      await SectionChecklist.create({
        section_id: section._id,
        text: item.text,
        comment: item.comment,
        type: 'information',
        tab: 'information',
        order_index: item.order_index,
      });
    }
    return;
  }

  for (const item of RESOURCES_CHECKLISTS) {
    const existingChecklist = await SectionChecklist.findOne({ section_id: section._id, text: item.text });
    if (!existingChecklist) {
      await SectionChecklist.create({
        section_id: section._id,
        text: item.text,
        comment: item.comment,
        type: 'information',
        tab: 'information',
        order_index: item.order_index,
      });
      continue;
    }

    let shouldSave = false;
    if (existingChecklist.type !== 'information') {
      existingChecklist.type = 'information';
      shouldSave = true;
    }

    if (existingChecklist.tab !== 'information') {
      existingChecklist.tab = 'information';
      shouldSave = true;
    }

    if (shouldSave) {
      await existingChecklist.save();
    }
  }
}

// Force this route to be dynamic and bypass any caching at the framework level
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
