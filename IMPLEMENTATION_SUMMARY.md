# Implementation Summary: Move Defects to Reports

## Completed Implementation

This document summarizes the changes made to move defect functionality from the inspection edit page to the report editing page, with defects now linked to template, section, and subsection.

## Changes Made

### 1. Database Model Updates ✅

**File: `src/models/Defect.ts`**
- Added three new optional fields to IDefect interface:
  - `templateId?: mongoose.Types.ObjectId`
  - `sectionId?: mongoose.Types.ObjectId`
  - `subsectionId?: mongoose.Types.ObjectId`
- Added corresponding schema fields with indexes
- Added compound index for efficient subsection queries: `{ inspection_id: 1, templateId: 1, sectionId: 1, subsectionId: 1, createdAt: -1 }`

### 2. Library Functions ✅

**File: `lib/defect.ts`**
- Updated `createDefect()` to accept optional `templateId`, `sectionId`, `subsectionId` parameters
- Updated `updateDefect()` to handle the new fields with proper ObjectId conversion
- Created new function `getDefectsBySubsection()` for filtered queries

### 3. API Routes ✅

**File: `src/app/api/llm/analyze-image/route.ts`**
- Added `templateId`, `sectionId`, `subsectionId` to request body parsing
- Updated QStash publish payload to include these fields

**File: `src/app/api/process-analysis/route.ts`**
- Added new fields to body extraction
- Updated defectData object to include `templateId`, `sectionId`, `subsectionId`

**File: `src/app/api/defects/[inspectionId]/route.ts`**
- Updated PATCH endpoint to accept and update the new fields

**File: `src/app/api/defects/by-subsection/route.ts` (NEW)**
- Created new GET endpoint for fetching defects by subsection
- Accepts query parameters: `inspectionId`, `templateId`, `sectionId`, `subsectionId`

### 4. Frontend Components ✅

**File: `src/app/(authenticated)/reports/edit/[inspectionId]/[inspectionTemplateId]/_components/DefectsSection.tsx` (NEW)**
- Created new component for displaying and managing defects within subsections
- Features:
  - Fetches defects filtered by subsection using new API endpoint
  - Displays defects using existing DefectCard component
  - Provides "Create Defect" button with auto-assignment of IDs
  - Includes search functionality
  - Handles delete operations

**File: `components/ImageEditorModal.tsx`**
- Added new props: `templateId?`, `sectionId?`, `subsectionId?`
- Updated submit handler to pass these IDs to analyze-image API

**File: `src/app/(authenticated)/reports/edit/[inspectionId]/[inspectionTemplateId]/_components/ChecklistContent.tsx`**
- Added import for DefectsSection
- Integrated DefectsSection below checklist content (after line 1090)

### 5. TypeScript Interfaces ✅

**Updated Defect interface in:**
- `src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard.tsx`
- `components/DefectEditModal.tsx`

Added optional fields:
```typescript
templateId?: string;
sectionId?: string;
subsectionId?: string;
```

### 6. Migration Script ✅

**File: `scripts/migrate-defects-add-template-refs.ts` (NEW)**
- Script to handle existing defects without the new fields
- Sets fields to null for inspection-level defects
- Can be run with: `npx tsx scripts/migrate-defects-add-template-refs.ts`

## How It Works

### Defect Creation Flow

1. User navigates to report editing page → selects section → selects subsection
2. User clicks "Create Defect" in the DefectsSection component
3. ImageEditorModal opens with `templateId`, `sectionId`, `subsectionId` pre-filled
4. User edits image and submits
5. Request goes to `/api/llm/analyze-image` with the subsection IDs
6. QStash queues the job to `/api/process-analysis`
7. Defect is created with all IDs linked
8. DefectsSection refreshes and shows the new defect

### Defect Display Flow

1. User views a subsection in report editing page
2. DefectsSection component automatically renders below checklists
3. Component fetches defects via `/api/defects/by-subsection`
4. Only defects matching the current subsection are displayed
5. User can edit, delete, or create new defects

## Backward Compatibility

- Existing defects without `templateId`, `sectionId`, `subsectionId` will still work
- These fields are optional in the model
- Old defects appear in inspection edit page but not in report subsections
- Migration script can mark old defects appropriately

## Testing Recommendations

Run through these test cases:

1. **Create Defect in Report**
   - Navigate to a subsection in report editing page
   - Click "Create Defect"
   - Verify templateId, sectionId, subsectionId are saved

2. **View Defects by Subsection**
   - Navigate between different subsections
   - Verify defects are filtered correctly
   - Only defects for current subsection should appear

3. **Edit Defect**
   - Edit a defect from report page
   - Verify subsection linkage is preserved

4. **Delete Defect**
   - Delete a defect from report page
   - Verify it's removed from database

5. **Backward Compatibility**
   - Verify inspection edit page still works
   - Old defects without subsection IDs should still display

6. **Search Functionality**
   - Test search in DefectsSection
   - Verify filtering works correctly

## Files Modified

### Models
- `src/models/Defect.ts`

### API Routes
- `src/app/api/llm/analyze-image/route.ts`
- `src/app/api/process-analysis/route.ts`
- `src/app/api/defects/[inspectionId]/route.ts`
- `src/app/api/defects/by-subsection/route.ts` (NEW)

### Libraries
- `lib/defect.ts`

### Components
- `src/app/(authenticated)/reports/edit/[inspectionId]/[inspectionTemplateId]/_components/DefectsSection.tsx` (NEW)
- `src/app/(authenticated)/reports/edit/[inspectionId]/[inspectionTemplateId]/_components/ChecklistContent.tsx`
- `components/ImageEditorModal.tsx`
- `src/app/(authenticated)/inspections/[id]/edit/_components/DefectCard.tsx`
- `components/DefectEditModal.tsx`

### Scripts
- `scripts/migrate-defects-add-template-refs.ts` (NEW)

## Next Steps

1. Run the migration script if you have existing defects
2. Test the functionality thoroughly
3. Monitor for any issues with defect creation/display
4. Consider adding UI indicators showing which subsection a defect belongs to

## Notes

- All TypeScript checks pass ✅
- No linter errors found ✅
- The implementation follows the architectural plan exactly
- Fields are optional to maintain backward compatibility
- Existing inspection edit page functionality is preserved
