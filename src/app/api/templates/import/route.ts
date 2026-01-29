import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import DefectNarrative from '@/src/models/DefectNarrative';
import type { ITemplateSection, ITemplateSubsection, ITemplateChecklist } from '@/src/models/Template';
import mongoose from 'mongoose';

interface ExcelRow {
  sectionName: string;
  itemName: string;
  commentName: string;
  commentText: string;
  commentType: string; // info, limit, defect
  multipleChoiceOptions: string; // comma-separated
  unitTypeOptions: string; // comma-separated
  order: string | number;
  answerType: string; // boolean, checkbox, date, number, range, text
  defaultValue: string;
  defaultValue2: string; // for "range" types
  defaultUnitType: string; // for "number" and "range" types
  defaultLocation: string;
}

// Transform commentType from Excel to Template model
// info → status, limit → information, defect → defects
function transformCommentType(commentType: string): 'status' | 'information' | 'defects' {
  const normalized = commentType.toLowerCase().trim();
  if (normalized === 'info') return 'status';
  if (normalized === 'limit') return 'information';
  if (normalized === 'defect') return 'defects';
  // Default fallback
  return 'information';
}

// Transform answerType from Excel to Template model field
// boolean → checkbox, checkbox → multipleAnswers, date → date, number → number, range → numberRange, text → text
function transformAnswerType(answerType: string): 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text' | undefined {
  const normalized = answerType.toLowerCase().trim();
  const mapping: Record<string, 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text'> = {
    'boolean': 'checkbox',
    'checkbox': 'multipleAnswers',
    'date': 'date',
    'number': 'number',
    'range': 'numberRange',
    'text': 'text',
  };
  return mapping[normalized];
}

// Parse comma-separated string to array
function parseCommaSeparated(value: string): string[] {
  if (!value || !value.trim()) return [];
  return value.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

// Parse order to number
function parseOrder(order: string | number): number {
  if (typeof order === 'number') return order;
  const parsed = parseInt(String(order), 10);
  return isNaN(parsed) ? 0 : parsed;
}

// Parse boolean from string
function parseBoolean(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

// Parse number from string
function parseNumber(value: string): number | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

// Parse date from string
function parseDate(value: string): Date | undefined {
  if (!value || !value.trim()) return undefined;
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? undefined : parsed;
}

// Transform Excel row to Template Checklist
function transformChecklist(row: ExcelRow): ITemplateChecklist {
  const field = transformAnswerType(row.answerType);
  const type = transformCommentType(row.commentType);
  
  // Determine answerChoices - prefer multipleChoiceOptions, fallback to unitTypeOptions
  let answerChoices: string[] | undefined = undefined;
  if (row.multipleChoiceOptions && row.multipleChoiceOptions.trim()) {
    answerChoices = parseCommaSeparated(row.multipleChoiceOptions);
  } else if (row.unitTypeOptions && row.unitTypeOptions.trim()) {
    answerChoices = parseCommaSeparated(row.unitTypeOptions);
  }

  const checklist: ITemplateChecklist = {
    type,
    name: row.commentName.trim(),
    orderIndex: parseOrder(row.order),
    field: (type === 'status' || type === 'information') ? field : undefined,
    location: row.defaultLocation?.trim() || undefined,
    comment: row.commentText?.trim() || undefined,
    answerChoices: answerChoices && answerChoices.length > 0 ? answerChoices : undefined,
  };

  // Map defaultValue based on field type
  if (field && row.defaultValue) {
    switch (field) {
      case 'checkbox':
        checklist.defaultChecked = parseBoolean(row.defaultValue);
        break;
      case 'multipleAnswers':
        checklist.selectedAnswers = parseCommaSeparated(row.defaultValue);
        break;
      case 'date':
        checklist.dateAnswer = parseDate(row.defaultValue);
        break;
      case 'number':
        checklist.numberAnswer = parseNumber(row.defaultValue);
        if (row.defaultUnitType?.trim()) {
          checklist.numberUnit = row.defaultUnitType.trim();
        }
        break;
      case 'numberRange':
        checklist.rangeFrom = parseNumber(row.defaultValue);
        if (row.defaultValue2?.trim()) {
          checklist.rangeTo = parseNumber(row.defaultValue2);
        }
        if (row.defaultUnitType?.trim()) {
          checklist.rangeUnit = row.defaultUnitType.trim();
        }
        break;
      case 'text':
        checklist.textAnswer = row.defaultValue.trim();
        break;
    }
  }

  return checklist;
}

// Transform Excel data to Template structure
function transformExcelDataToTemplate(data: ExcelRow[], templateName: string): { name: string; sections: ITemplateSection[] } {
  // Group by section, then by subsection
  const sectionMap = new Map<string, Map<string, ExcelRow[]>>();
  
  data.forEach((row) => {
    const sectionName = row.sectionName?.trim() || '(No Section)';
    const itemName = row.itemName?.trim() || '(No Item)';
    
    if (!sectionMap.has(sectionName)) {
      sectionMap.set(sectionName, new Map());
    }
    
    const subsectionMap = sectionMap.get(sectionName)!;
    if (!subsectionMap.has(itemName)) {
      subsectionMap.set(itemName, []);
    }
    
    subsectionMap.get(itemName)!.push(row);
  });

  // Build sections array
  const sections: ITemplateSection[] = [];
  let sectionOrderIndex = 0;

  sectionMap.forEach((subsectionMap, sectionName) => {
    const subsections: ITemplateSubsection[] = [];
    let subsectionOrderIndex = 0;

    subsectionMap.forEach((rows, itemName) => {
      const checklists: ITemplateChecklist[] = rows.map(transformChecklist);
      
      // Sort checklists by orderIndex
      checklists.sort((a, b) => a.orderIndex - b.orderIndex);

      subsections.push({
        name: itemName,
        informationalOnly: false,
        includeInEveryReport: true,
        orderIndex: subsectionOrderIndex++,
        checklists,
      });
    });

    // Sort subsections by orderIndex
    subsections.sort((a, b) => a.orderIndex - b.orderIndex);

    sections.push({
      name: sectionName,
      excludeFromSummaryView: false,
      includeInEveryReport: false,
      startSectionOnNewPage: false,
      sectionIcon: 'Home',
      orderIndex: sectionOrderIndex++,
      subsections,
    });
  });

  // Sort sections by orderIndex
  sections.sort((a, b) => a.orderIndex - b.orderIndex);

  return {
    name: templateName,
    sections,
  };
}

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!currentUser.company) {
      return NextResponse.json(
        { error: 'No company associated with current user' },
        { status: 400 }
      );
    }

    const body = await request.json();
    let { templateName, data, source, useNarrative } = body;

    // Validate inputs
    if (!templateName || !templateName.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }

    if (!data || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: 'Excel data is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate source
    const validSources = ['report-writer', 'spectora'];
    const importSource = source || 'spectora'; // Default to spectora for backward compatibility
    if (!validSources.includes(importSource)) {
      return NextResponse.json(
        { error: `Invalid source. Must be one of: ${validSources.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate required fields in data
    const validationErrors: string[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // +2 because row 1 is header, data starts at row 2
      
      // Required fields validation
      if (!row.sectionName?.trim() && !row.itemName?.trim() && !row.commentName?.trim()) {
        validationErrors.push(`Row ${rowNum}: At least one of sectionName, itemName, or commentName is required`);
      }

      // For Report Writer AI, validate required fields more strictly
      if (importSource === 'report-writer') {
        if (!row.sectionName?.trim()) {
          validationErrors.push(`Row ${rowNum}: Section Name is required`);
        }
        if (!row.itemName?.trim()) {
          validationErrors.push(`Row ${rowNum}: Item Name is required`);
        }
        if (!row.commentName?.trim()) {
          validationErrors.push(`Row ${rowNum}: Comment Name is required`);
        }

        // Validate commentType enum
        if (row.commentType) {
          const validCommentTypes = ['info', 'limit', 'defect'];
          const normalizedType = row.commentType.toLowerCase().trim();
          if (!validCommentTypes.includes(normalizedType)) {
            validationErrors.push(`Row ${rowNum}: Invalid Comment Type "${row.commentType}". Must be one of: ${validCommentTypes.join(', ')}`);
          }
        }

        // Validate answerType enum
        if (row.answerType) {
          const validAnswerTypes = ['boolean', 'checkbox', 'date', 'number', 'range', 'text'];
          const normalizedType = row.answerType.toLowerCase().trim();
          if (!validAnswerTypes.includes(normalizedType)) {
            validationErrors.push(`Row ${rowNum}: Invalid Answer Type "${row.answerType}". Must be one of: ${validAnswerTypes.join(', ')}`);
          }
        }

        // Validate order is numeric if provided
        if (row.order !== undefined && row.order !== null && row.order !== '') {
          const orderNum = typeof row.order === 'number' ? row.order : parseFloat(String(row.order));
          if (isNaN(orderNum)) {
            validationErrors.push(`Row ${rowNum}: Order must be a valid number`);
          }
        }

        // Validate date format if answerType is date and defaultValue is provided
        if (row.answerType?.toLowerCase().trim() === 'date' && row.defaultValue) {
          const date = parseDate(row.defaultValue);
          if (!date) {
            validationErrors.push(`Row ${rowNum}: Invalid date format for Default Value "${row.defaultValue}"`);
          }
        }

        // Validate number format if answerType is number/range and defaultValue is provided
        if ((row.answerType?.toLowerCase().trim() === 'number' || row.answerType?.toLowerCase().trim() === 'range') && row.defaultValue) {
          const num = parseNumber(row.defaultValue);
          if (num === undefined) {
            validationErrors.push(`Row ${rowNum}: Invalid number format for Default Value "${row.defaultValue}"`);
          }
        }

        // Validate range has both from and to values
        if (row.answerType?.toLowerCase().trim() === 'range') {
          if (row.defaultValue && !row.defaultValue2) {
            validationErrors.push(`Row ${rowNum}: Range Answer Type requires both Default Value and Default Value 2`);
          }
        }
      }
    }

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          error: 'Validation errors found',
          details: validationErrors
        },
        { status: 400 }
      );
    }

    // Check for duplicate template name
    const existingTemplate = await Template.findOne({
      name: templateName.trim(),
      company: currentUser.company,
      deletedAt: null,
    });

    if (existingTemplate) {
      // Generate unique name by appending number
      let counter = 1;
      let uniqueName = `${templateName.trim()} (${counter})`;
      while (await Template.findOne({
        name: uniqueName,
        company: currentUser.company,
        deletedAt: null,
      })) {
        counter++;
        uniqueName = `${templateName.trim()} (${counter})`;
      }
      templateName = uniqueName;
    }

    // Handle based on source
    if (importSource === 'report-writer') {
      // Report Writer AI: Direct mapping, no defect narrative separation
      const templateData = transformExcelDataToTemplate(data as ExcelRow[], templateName.trim());

      // Create template
      const newTemplate = await Template.create({
        name: templateData.name,
        company: currentUser.company,
        createdBy: currentUser._id,
        sections: templateData.sections,
      });

      return NextResponse.json(
        { 
          message: 'Template imported successfully', 
          template: newTemplate.toObject(),
        },
        { status: 201 }
      );
    } else {
      // Spectora: Original logic with defect narrative separation
      // Filter defect rows BEFORE any Template processing
      const defectRows = (data as ExcelRow[]).filter(
        (row) => row.commentType?.toLowerCase().trim() === 'defect'
      );
      const nonDefectRows = (data as ExcelRow[]).filter(
        (row) => row.commentType?.toLowerCase().trim() !== 'defect'
      );

      // Transform Excel data to Template structure (ONLY non-defect rows)
      const templateData = transformExcelDataToTemplate(nonDefectRows, templateName.trim());

      // Create template with only non-defect data
      const newTemplate = await Template.create({
        name: templateData.name,
        company: currentUser.company,
        createdBy: currentUser._id,
        sections: templateData.sections,
      });

      // Save defect data to DefectNarrative table (only if useNarrative is true)
      let defectNarrativesCount = 0;
      if (useNarrative && defectRows.length > 0) {
        const defectNarratives = defectRows
          .filter((row) => {
            // Only include rows with required fields
            return (
              row.sectionName?.trim() &&
              row.itemName?.trim() &&
              row.commentText?.trim()
            );
          })
          .map((row) => ({
            company: currentUser.company,
            template: newTemplate._id,
            sectionName: row.sectionName.trim(),
            subsectionName: row.itemName.trim(),
            narrative: row.commentText.trim(),
          }));

        if (defectNarratives.length > 0) {
          await DefectNarrative.insertMany(defectNarratives);
          defectNarrativesCount = defectNarratives.length;
        }
      }

      return NextResponse.json(
        { 
          message: 'Template imported successfully', 
          template: newTemplate.toObject(),
          defectNarrativesCount
        },
        { status: 201 }
      );
    }
  } catch (error: any) {
    console.error('Import template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import template' },
      { status: 500 }
    );
  }
}
