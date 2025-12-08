# Defects Page - User Guide

## Overview
A new authenticated page has been created at `/defects` that integrates with your FastAPI backend running on `localhost:8000`.

## Accessing the Page
Navigate to: `http://localhost:3000/defects` (after logging in)

## Features

### 1. Classify Defect Mode
Upload a single defect image and get AI-powered classification results.

**Required Fields:**
- **Defect Image**: Upload an image of the defect (required)
- **Company ID**: Your company identifier (required)

**Optional Fields:**
- **Context**: Additional text context about the defect
- **Include Pricing**: Toggle to get pricing estimates

**When Pricing is Enabled:**
- Zip Code
- Overhead/Profit Factor (default: 1.0)
- State
- City
- Severity Override (dropdown: major_hazard, repair_needed, maintenance_minor)

**Results Display:**
- Title
- Narrative (detailed description)
- Severity (color-coded badge)
- Trade (contractor type)
- **If pricing included:**
  - Action Type
  - Task Description
  - Labor Hours
  - Materials Table (with quantities, unit prices, totals)
  - Cost Summary (materials cost, labor cost, estimated total)

### 2. Extract from Screenshots Mode
Upload multiple inspection screenshots to extract defect data and save to Supabase.

**Required Fields:**
- **Company ID**: Your company identifier (required)
- **Screenshot Files**: Multiple image files (required)

**Results Display:**
- Count of successfully inserted records
- Count of failed records
- Detailed error messages for any failures
- Success confirmation message

## API Endpoints Used

### Classification
```
POST http://localhost:8000/classify
```
- Sends image file + form data
- Returns defect classification with optional pricing

### Extraction
```
POST http://localhost:8000/extractor/upload
```
- Sends multiple screenshot files + company ID
- Extracts and saves defect examples to Supabase
- Returns count of inserted/failed records

## Design Features

- **Modern UI**: Gradient buttons matching the image-editor page style
- **Tab Interface**: Easy switching between Classify and Extract modes
- **Responsive Design**: Works on mobile and desktop
- **Loading States**: Spinners during API calls
- **Error Handling**: Clear error messages displayed
- **Color-Coded Results**: Severity badges with distinct colors
  - Red: Major Hazard
  - Orange: Repair Needed
  - Blue: Maintenance/Minor
- **Materials Table**: Professional table layout for pricing materials
- **File Upload**: Drag-and-drop style file inputs

## Testing Checklist

### Before Testing
1. Ensure FastAPI is running: `uvicorn main:app --reload` (in FastAPI_Setup folder)
2. Ensure Next.js dev server is running: `npm run dev`
3. Log in to the Next.js app

### Test Classification
1. Navigate to `/defects`
2. Stay on "Classify Defect" tab
3. Upload a defect image
4. Enter a company ID (use one from your Supabase `defect_examples` table)
5. Optionally add context
6. Click "Classify Defect"
7. Verify results display correctly

### Test Classification with Pricing
1. Upload a defect image
2. Enter company ID
3. Check "Include Pricing Information"
4. Fill in the pricing fields (state, city, etc.)
5. Click "Classify Defect"
6. Verify pricing information displays in results

### Test Extraction
1. Click "Extract from Screenshots" tab
2. Enter company ID
3. Upload multiple screenshot files
4. Click "Extract Data"
5. Verify success/error counts
6. Check Supabase `defect_examples` table for new records

## Troubleshooting

### CORS Errors
- FastAPI already has CORS middleware configured with `allow_origins=["*"]`
- If issues persist, check FastAPI console for errors

### API Connection Issues
- Verify FastAPI is running on `localhost:8000`
- Check FastAPI logs for errors
- Ensure `.env` file is configured in FastAPI_Setup folder

### No Results Displayed
- Check browser console for JavaScript errors
- Verify API response in Network tab (DevTools)
- Check FastAPI console for backend errors

### Supabase Connection Issues (for Extraction)
- Verify Supabase credentials in FastAPI `.env` file
- Check that `defect_examples` table exists
- Verify company_id exists in your Supabase database

## File Locations

- **Page Component**: `src/app/(authenticated)/defects/page.tsx`
- **FastAPI Backend**: `E:/1-aaron/FastAPI_Setup/main.py`

## Next Steps

To add navigation to this page:
1. Update the sidebar/navbar to include a link to `/defects`
2. Add appropriate icons and labels
3. Consider adding to the dashboard quick links

## Notes

- This is a standalone page (doesn't save to MongoDB defects database)
- Results are displayed in the UI only
- Extraction mode saves directly to Supabase via FastAPI
- Classification mode returns results but doesn't persist them (unless you add that functionality)


