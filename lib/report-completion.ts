import dbConnect from "@/lib/db";
import InspectionTemplate from "@/src/models/InspectionTemplate";
import { getFlaggedDefectSubsectionIds } from "@/lib/defect";

export interface CompletionStatus {
  sections: {
    [sectionId: string]: {
      isComplete: boolean;
      subsections: {
        [subsectionId: string]: {
          isComplete: boolean;
          totalStatusChecklists: number;
          completedStatusChecklists: number;
        };
      };
    };
  };
}

/**
 * Compute completion status for all sections and subsections.
 * - Subsection with no status checklists is treated as checklist-complete (auto-checked).
 * - Subsection with status checklists is complete only when all have defaultChecked true.
 * - Any subsection with a defect where isFlagged === true is not complete.
 * - Section is complete when all its subsections are complete.
 */
export async function getCompletionStatus(
  inspectionId: string,
  templateId: string
): Promise<CompletionStatus> {
  await dbConnect();

  const template = await InspectionTemplate.findById(templateId).lean();
  if (!template) {
    return { sections: {} };
  }

  const { subsectionIds: flaggedSubsectionIds } =
    await getFlaggedDefectSubsectionIds(inspectionId, templateId);
  const flaggedSet = new Set(flaggedSubsectionIds);

  const completionStatus: CompletionStatus = { sections: {} };
  const sections = (template as any).sections || [];

  for (const section of sections) {
    if (section.deletedAt) continue;

    const sectionId = section._id.toString();
    completionStatus.sections[sectionId] = {
      isComplete: false,
      subsections: {},
    };

    const subsections = section.subsections || [];
    let completedSubsectionsCount = 0;
    let totalSubsectionsCount = 0;

    for (const subsection of subsections) {
      if (subsection.deletedAt) continue;

      totalSubsectionsCount++;
      const subsectionId = subsection._id.toString();

      const checklists = subsection.checklists || [];
      let totalStatusChecklists = 0;
      let completedStatusChecklists = 0;

      for (const checklist of checklists) {
        if (checklist.type === "status") {
          totalStatusChecklists++;
          if (checklist.defaultChecked === true) {
            completedStatusChecklists++;
          }
        }
      }

      // Empty checklist = auto-complete; otherwise all must be checked
      const checklistComplete =
        totalStatusChecklists === 0 ||
        completedStatusChecklists === totalStatusChecklists;
      // Subsection is complete only if checklist complete AND no flagged defect
      const isSubsectionComplete =
        checklistComplete && !flaggedSet.has(subsectionId);

      completionStatus.sections[sectionId].subsections[subsectionId] = {
        isComplete: isSubsectionComplete,
        totalStatusChecklists,
        completedStatusChecklists,
      };

      if (isSubsectionComplete) {
        completedSubsectionsCount++;
      }
    }

    completionStatus.sections[sectionId].isComplete =
      totalSubsectionsCount > 0 &&
      completedSubsectionsCount === totalSubsectionsCount;
  }

  return completionStatus;
}
