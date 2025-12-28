import mongoose from 'mongoose';
import Section from '@/src/models/Section';
import SectionChecklist from '@/src/models/SectionChecklist';
import InspectionInformationBlock from '@/src/models/InspectionInformationBlock';

/**
 * Checks if all status-type checklist items across all sections are selected for an inspection.
 * A section is considered complete if all its status checklists are selected.
 * Sections with no status items are skipped (considered complete).
 * 
 * @param inspectionId - The inspection ID to check
 * @returns Promise<boolean> - true if all status fields are complete, false otherwise
 */
export async function checkAllStatusFieldsComplete(inspectionId: string): Promise<boolean> {
  try {
    // Ensure MongoDB connection
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI!);
    }

    // Validate inspectionId
    if (!inspectionId || !mongoose.isValidObjectId(inspectionId)) {
      return false;
    }

    // 1. Fetch all sections
    const sections = await Section.find({}).sort({ order_index: 1 }).lean();
    
    // If no sections exist, return false (can't be complete without any sections)
    if (!sections || sections.length === 0) {
      return false;
    }

    // 2. Fetch all status-type checklists for all sections
    const sectionIds = sections.map(s => s._id);
    const allStatusChecklists = await SectionChecklist.find({
      section_id: { $in: sectionIds },
      type: 'status'
    }).lean();

    // Group status checklists by section_id
    const statusChecklistsBySection = new Map<string, string[]>();
    for (const checklist of allStatusChecklists) {
      const sectionId = checklist.section_id.toString();
      if (!statusChecklistsBySection.has(sectionId)) {
        statusChecklistsBySection.set(sectionId, []);
      }
      statusChecklistsBySection.get(sectionId)!.push(checklist._id.toString());
    }

    // 3. Fetch all blocks for this inspection
    const blocks = await InspectionInformationBlock.find({
      inspection_id: inspectionId
    }).lean();

    // 4. Collect all selected checklist IDs from all blocks
    const selectedChecklistIds = new Set<string>();
    for (const block of blocks) {
      if (Array.isArray(block.selected_checklist_ids)) {
        for (const checklistId of block.selected_checklist_ids) {
          // Handle both string IDs and populated objects
          const id = typeof checklistId === 'string' 
            ? checklistId 
            : (checklistId as any)?._id?.toString() || checklistId?.toString();
          if (id) {
            selectedChecklistIds.add(id);
          }
        }
      }
    }

			console.log(sections)

    // 5. For each section, verify all status checklist IDs are in the selected set
    for (const section of sections) {
      const sectionId = section._id.toString();
      const statusIdsForSection = statusChecklistsBySection.get(sectionId) || [];
      
      // Skip sections with no status items (considered complete)
      if (statusIdsForSection.length === 0) {
        continue;
      }

      // Check if all status items for this section are selected
      const allStatusSelected = statusIdsForSection.every(statusId => 
        selectedChecklistIds.has(statusId)
      );

      // If any section is incomplete, return false
      if (!allStatusSelected) {
        return false;
      }
    }

    // All sections with status items have all their status items selected
    return true;
  } catch (error) {
    console.error('Error checking status fields completion:', error);
    // On error, return false (safer to assume incomplete)
    return false;
  }
}

