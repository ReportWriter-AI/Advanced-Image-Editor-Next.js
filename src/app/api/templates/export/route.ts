import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Template from '@/src/models/Template';
import * as XLSX from 'xlsx';
import mongoose from 'mongoose';
import type { ITemplateSection, ITemplateSubsection, ITemplateChecklist } from '@/src/models/Template';

// Transform Template model to Excel format
// Reverse of import transformations
function transformCommentTypeForExport(type: 'status' | 'information' | 'defects'): string {
  const mapping: Record<string, string> = {
    'status': 'info',
    'information': 'limit',
    'defects': 'defect',
  };
  return mapping[type] || 'limit';
}

function transformAnswerTypeForExport(field?: 'checkbox' | 'multipleAnswers' | 'date' | 'number' | 'numberRange' | 'text'): string {
  if (!field) return '';
  const mapping: Record<string, string> = {
    'checkbox': 'boolean',
    'multipleAnswers': 'checkbox',
    'date': 'date',
    'number': 'number',
    'numberRange': 'range',
    'text': 'text',
  };
  return mapping[field] || '';
}

function formatArrayForExport(arr: string[] | undefined): string {
  if (!arr || arr.length === 0) return '';
  return arr.join(', ');
}

function formatDateForExport(date: Date | undefined): string {
  if (!date) return '';
  return date.toISOString().split('T')[0]; // YYYY-MM-DD format
}

function formatNumberForExport(num: number | undefined): string {
  if (num === undefined || num === null) return '';
  return String(num);
}

function formatBooleanForExport(bool: boolean | undefined): string {
  if (bool === undefined || bool === null) return '';
  return bool ? 'true' : 'false';
}

// Format date for filename in M/D/YYYY format (e.g., 1/24/2026)
function formatDateForFilename(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
}

// Transform Template to Excel rows
function templateToExcelRows(template: any): any[] {
  const rows: any[] = [];
  
  if (!template.sections || template.sections.length === 0) {
    return rows;
  }

  template.sections.forEach((section: ITemplateSection) => {
    if (!section.subsections || section.subsections.length === 0) {
      return;
    }

    section.subsections.forEach((subsection: ITemplateSubsection) => {
      if (!subsection.checklists || subsection.checklists.length === 0) {
        return;
      }

      subsection.checklists.forEach((checklist: ITemplateChecklist) => {
        const row: any = {
          'Section Name': section.name || '',
          'Item Name': subsection.name || '',
          'Comment Name': checklist.name || '',
          'Comment Text': checklist.comment || '',
          'Comment Type': transformCommentTypeForExport(checklist.type),
          'Multiple Choice Options': formatArrayForExport(checklist.answerChoices),
          'Unit Type Options': '', // Not used in export, but kept for compatibility
          'Order': checklist.orderIndex || 0,
          'Answer Type': transformAnswerTypeForExport(checklist.field),
          'Default Value': '',
          'Default Value 2': '',
          'Default Unit Type': '',
          'Default Location': checklist.location || '',
        };

        // Map default values based on field type
        if (checklist.field) {
          switch (checklist.field) {
            case 'checkbox':
              row['Default Value'] = formatBooleanForExport(checklist.defaultChecked);
              break;
            case 'multipleAnswers':
              row['Default Value'] = formatArrayForExport(checklist.selectedAnswers);
              break;
            case 'date':
              row['Default Value'] = formatDateForExport(checklist.dateAnswer);
              break;
            case 'number':
              row['Default Value'] = formatNumberForExport(checklist.numberAnswer);
              row['Default Unit Type'] = checklist.numberUnit || '';
              break;
            case 'numberRange':
              row['Default Value'] = formatNumberForExport(checklist.rangeFrom);
              row['Default Value 2'] = formatNumberForExport(checklist.rangeTo);
              row['Default Unit Type'] = checklist.rangeUnit || '';
              break;
            case 'text':
              row['Default Value'] = checklist.textAnswer || '';
              break;
          }
        }

        rows.push(row);
      });
    });
  });

  return rows;
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
    const { templateIds } = body;

    // Validate inputs
    if (!templateIds || !Array.isArray(templateIds) || templateIds.length === 0) {
      return NextResponse.json(
        { error: 'Template IDs are required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate template IDs are valid ObjectIds
    const validTemplateIds = templateIds.filter((id: string) => {
      try {
        return mongoose.Types.ObjectId.isValid(id);
      } catch {
        return false;
      }
    });

    if (validTemplateIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid template IDs provided' },
        { status: 400 }
      );
    }

    // Fetch templates
    const templates = await Template.find({
      _id: { $in: validTemplateIds },
      company: currentUser.company,
      deletedAt: null,
    }).lean();

    if (templates.length === 0) {
      return NextResponse.json(
        { error: 'No templates found' },
        { status: 404 }
      );
    }

    // If only one template, export as single file
    if (templates.length === 1) {
      const template = templates[0];
      const rows = templateToExcelRows(template);
      
      if (rows.length === 0) {
        return NextResponse.json(
          { error: 'Template has no data to export' },
          { status: 400 }
        );
      }

      // Create workbook
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');

      // Generate buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      // Generate filename with date in M/D/YYYY format
      const sanitizedName = template.name.replace(/[^a-z0-9]/gi, '_');
      const dateStr = formatDateForFilename(new Date());
      const filename = `${sanitizedName}_${dateStr.replace(/\//g, '_')}.xlsx`;
      const encodedFilename = encodeURIComponent(filename);
      
      // Return file with proper Content-Disposition header (RFC 5987)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
        },
      });
    }

    // Multiple templates - create one file with multiple sheets
    const workbook = XLSX.utils.book_new();
    
    for (const template of templates) {
      const rows = templateToExcelRows(template);
      
      if (rows.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(rows);
        // Sheet name must be <= 31 characters and cannot contain certain characters
        const sheetName = template.name.substring(0, 31).replace(/[\\/?*\[\]]/g, '_');
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      }
    }

    // Check if workbook has any sheets
    if (workbook.SheetNames.length === 0) {
      return NextResponse.json(
        { error: 'No templates with data to export' },
        { status: 400 }
      );
    }

    // Generate buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    // Generate filename with date in M/D/YYYY format
    const dateStr = formatDateForFilename(new Date());
    const filename = `templates-export_${dateStr.replace(/\//g, '_')}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);
    
    // Return file with proper Content-Disposition header (RFC 5987)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  } catch (error: any) {
    console.error('Export template error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to export templates' },
      { status: 500 }
    );
  }
}
