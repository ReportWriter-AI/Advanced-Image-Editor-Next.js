# Testing Checklist for Defects in Reports Feature

## Overview
This document provides a comprehensive testing checklist for the newly implemented defects functionality in the report editing page.

## Pre-Testing Setup

- [ ] Run migration script: `npx tsx scripts/migrate-defects-add-template-refs.ts`
- [ ] Ensure database is backed up
- [ ] Clear browser cache
- [ ] Start development server

## 1. Defect Creation Tests

### 1.1 Basic Creation
- [ ] Navigate to Reports → Select an inspection → Select a template
- [ ] Select a section and subsection
- [ ] Verify "Defects" section appears below checklist content
- [ ] Click "Create Defect" button
- [ ] Image editor modal opens
- [ ] Upload an image and add description
- [ ] Select section, subsection, and location
- [ ] Submit and wait for processing
- [ ] Verify defect appears in the subsection

### 1.2 Verify Correct IDs Saved
- [ ] Create a defect in subsection A
- [ ] Use database tool to verify defect has correct `templateId`, `sectionId`, `subsectionId`
- [ ] Verify IDs match the current subsection

### 1.3 Multiple Defects
- [ ] Create 3 defects in the same subsection
- [ ] Verify all 3 appear in the defects list
- [ ] Verify they are sorted by creation date (newest first)

## 2. Defect Filtering Tests

### 2.1 Subsection Isolation
- [ ] Create defects in Subsection A
- [ ] Navigate to Subsection B
- [ ] Verify Subsection A's defects do NOT appear
- [ ] Create defects in Subsection B
- [ ] Navigate back to Subsection A
- [ ] Verify only Subsection A's defects appear

### 2.2 Section Navigation
- [ ] Create defects in Section 1 → Subsection A
- [ ] Create defects in Section 2 → Subsection A (different section, same subsection name)
- [ ] Navigate between the two
- [ ] Verify defects are properly isolated by section

### 2.3 Empty State
- [ ] Navigate to a subsection with no defects
- [ ] Verify empty state message appears
- [ ] Verify "Create Your First Defect" button is shown

## 3. Defect Editing Tests

### 3.1 Edit Defect
- [ ] Click edit button on a defect
- [ ] Modify description, materials, labor rate
- [ ] Auto-save indicator should show "Saving..."
- [ ] Wait for "Saved at [time]" message
- [ ] Click Done button
- [ ] Verify changes are persisted

### 3.2 Verify IDs Preserved
- [ ] Edit a defect
- [ ] Check database to verify `templateId`, `sectionId`, `subsectionId` remain unchanged
- [ ] Verify defect still appears in correct subsection

### 3.3 Add Additional Location Photos
- [ ] Edit a defect
- [ ] Click "Add Another Locations For This Defect"
- [ ] Upload multiple photos with different locations
- [ ] Verify photos appear in defect card
- [ ] Verify cost multiplier updates based on photo count

## 4. Defect Deletion Tests

### 4.1 Delete Single Defect
- [ ] Click delete button on a defect
- [ ] Confirm deletion dialog
- [ ] Verify defect disappears from list
- [ ] Refresh page
- [ ] Verify defect is still gone

### 4.2 Delete Last Defect
- [ ] In a subsection with only one defect
- [ ] Delete the defect
- [ ] Verify empty state appears

## 5. Search Functionality Tests

### 5.1 Basic Search
- [ ] Create defects with varied descriptions
- [ ] Enter search term in search box
- [ ] Verify matching defects appear
- [ ] Verify non-matching defects are hidden

### 5.2 Search Fields
- [ ] Verify search works for:
  - [ ] Description
  - [ ] Location
  - [ ] Materials
  - [ ] Section/Subsection names
  - [ ] Recommendation

### 5.3 Empty Search Results
- [ ] Enter a term that matches nothing
- [ ] Verify "No defects match your search" message appears

## 6. Image Editor Integration Tests

### 6.1 Annotations
- [ ] Create defect with annotations (arrows, circles, squares)
- [ ] Verify annotations are saved
- [ ] Edit the defect main image
- [ ] Verify previous annotations load correctly

### 6.2 360° Photos
- [ ] Create defect and mark as 360° photo
- [ ] Verify 360° viewer appears instead of static image
- [ ] Verify can interact with 360° viewer

### 6.3 Additional Location Photos
- [ ] Add additional location photo to existing defect
- [ ] Verify photo uploads correctly
- [ ] Annotate the additional photo
- [ ] Verify annotations save

## 7. API Endpoint Tests

### 7.1 By-Subsection Endpoint
- [ ] Open browser dev tools → Network tab
- [ ] Navigate to a subsection
- [ ] Verify `/api/defects/by-subsection` is called
- [ ] Verify query params include `inspectionId`, `templateId`, `sectionId`, `subsectionId`
- [ ] Verify response contains only relevant defects

### 7.2 Error Handling
- [ ] In dev tools, throttle network to slow
- [ ] Verify loading spinner appears
- [ ] Restore normal network
- [ ] Verify defects load correctly

## 8. Backward Compatibility Tests

### 8.1 Inspection Edit Page
- [ ] Navigate to Inspections → Select an inspection → Edit
- [ ] Verify defects tab still works
- [ ] Verify can create defects from inspection edit page
- [ ] Verify old defects (without subsection IDs) still appear

### 8.2 Old Defects
- [ ] If you have defects created before this update:
  - [ ] Verify they appear in inspection edit page
  - [ ] Verify they do NOT appear in report subsections (expected behavior)
  - [ ] Edit an old defect and assign it to a subsection
  - [ ] Verify it now appears in that subsection

## 9. Performance Tests

### 9.1 Large Dataset
- [ ] Create 20+ defects in one subsection
- [ ] Verify page loads in reasonable time
- [ ] Verify search is responsive
- [ ] Verify scrolling is smooth

### 9.2 Multiple Subsections
- [ ] Create defects in 10 different subsections
- [ ] Navigate between them
- [ ] Verify switching is fast
- [ ] Verify no memory leaks (check browser task manager)

## 10. Edge Cases

### 10.1 No Subsection Selected
- [ ] Navigate to report page without selecting subsection
- [ ] Verify DefectsSection does not render

### 10.2 Concurrent Editing
- [ ] Open same subsection in two browser tabs
- [ ] Create defect in tab 1
- [ ] Refresh tab 2
- [ ] Verify defect appears

### 10.3 Special Characters
- [ ] Create defect with special characters in description: `<script>alert("test")</script>`
- [ ] Verify no XSS vulnerability
- [ ] Verify special characters display correctly

## 11. Mobile/Responsive Tests

### 11.1 Mobile View
- [ ] Open in mobile browser or use dev tools device emulation
- [ ] Verify DefectsSection is responsive
- [ ] Verify create button is accessible
- [ ] Verify defect cards display correctly

### 11.2 Tablet View
- [ ] Test in tablet resolution
- [ ] Verify layout adapts properly

## 12. Integration Tests

### 12.1 Full Workflow
- [ ] Create a new inspection
- [ ] Add a template
- [ ] Add sections and subsections
- [ ] Create defects in each subsection
- [ ] Generate report
- [ ] Verify defects appear correctly in generated report

### 12.2 Copy/Clone Template
- [ ] If templates can be cloned, test that defects don't carry over

## Test Results Summary

| Category | Tests Passed | Tests Failed | Notes |
|----------|--------------|--------------|-------|
| Creation | _ / _ | _ / _ | |
| Filtering | _ / _ | _ / _ | |
| Editing | _ / _ | _ / _ | |
| Deletion | _ / _ | _ / _ | |
| Search | _ / _ | _ / _ | |
| Image Editor | _ / _ | _ / _ | |
| API | _ / _ | _ / _ | |
| Backward Compat | _ / _ | _ / _ | |
| Performance | _ / _ | _ / _ | |
| Edge Cases | _ / _ | _ / _ | |
| Mobile | _ / _ | _ / _ | |
| Integration | _ / _ | _ / _ | |

## Known Issues

Document any issues found during testing:

1. 
2. 
3. 

## Sign-off

- [ ] All critical tests passed
- [ ] All known issues documented
- [ ] Ready for production deployment

Tester Name: ___________________
Date: ___________________
Signature: ___________________
