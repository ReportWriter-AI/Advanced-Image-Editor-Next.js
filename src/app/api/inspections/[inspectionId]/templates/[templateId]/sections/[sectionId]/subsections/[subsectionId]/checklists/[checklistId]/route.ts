import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/db';
import { getCurrentUser } from '@/lib/auth-helpers';
import Inspection from '@/src/models/Inspection';
import InspectionTemplate from '@/src/models/InspectionTemplate';
import mongoose from 'mongoose';

interface RouteParams {
  params: Promise<{ inspectionId: string; templateId: string; sectionId: string; subsectionId: string; checklistId: string }>;
}

async function getAuthorizedInspectionTemplate(
  inspectionId: string,
  templateId: string,
  companyId: string | undefined,
  includeDeleted: boolean = false
): Promise<any> {
  if (!inspectionId || !mongoose.Types.ObjectId.isValid(inspectionId)) {
    return null;
  }
  if (!templateId || !mongoose.Types.ObjectId.isValid(templateId)) {
    return null;
  }

  const inspection = await Inspection.findById(inspectionId).lean();
  if (!inspection) {
    return null;
  }

  const inspectionCompanyId = (inspection as any).companyId?.toString();
  if (companyId && inspectionCompanyId !== companyId) {
    return null;
  }

  const inspectionTemplateIds = (inspection as any).inspectionTemplateIds || [];
  if (!inspectionTemplateIds.some((id: any) => id.toString() === templateId)) {
    return null;
  }

  const template = await InspectionTemplate.findById(templateId).lean();
  if (!template) {
    return null;
  }

  return template;
}

export async function PUT(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId, sectionId, subsectionId, checklistId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, subsection, or checklist ID' }, { status: 400 });
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString()
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if section exists
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Check if subsection exists
    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    // Check if checklist exists
    const existingChecklist = subsection.checklists?.find(
      (c: any) => c._id && c._id.toString() === checklistId
    );

    if (!existingChecklist) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      field,
      location,
      comment,
      defaultChecked,
      answerChoices,
      orderIndex,
      // Answer fields
      textAnswer,
      selectedAnswers,
      dateAnswer,
      numberAnswer,
      numberUnit,
      rangeFrom,
      rangeTo,
      rangeUnit,
    } = body;

    // If name is provided, validate it
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: 'Checklist name is required' }, { status: 400 });
    }

    // Validate field for status type
    if (existingChecklist.type === 'status' && field && !['checkbox', 'multipleAnswers', 'date', 'number', 'numberRange', 'signature', 'text'].includes(field)) {
      return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
    }

    // Validate answer fields match field type
    const checklistField = field || existingChecklist.field;
    if (existingChecklist.type === 'status' && checklistField) {
      // Validate textAnswer for text field
      if (checklistField === 'text' && textAnswer !== undefined && typeof textAnswer !== 'string') {
        return NextResponse.json({ error: 'textAnswer must be a string' }, { status: 400 });
      }
      
      // Validate selectedAnswers for multipleAnswers field
      if (checklistField === 'multipleAnswers' && selectedAnswers !== undefined) {
        if (!Array.isArray(selectedAnswers)) {
          return NextResponse.json({ error: 'selectedAnswers must be an array' }, { status: 400 });
        }
      }
      
      // Validate dateAnswer for date field
      if (checklistField === 'date' && dateAnswer !== undefined && !(dateAnswer instanceof Date || typeof dateAnswer === 'string')) {
        return NextResponse.json({ error: 'dateAnswer must be a date' }, { status: 400 });
      }
      
      // Validate numberAnswer for number field
      if (checklistField === 'number' && numberAnswer !== undefined && typeof numberAnswer !== 'number') {
        return NextResponse.json({ error: 'numberAnswer must be a number' }, { status: 400 });
      }
      
      // Validate rangeFrom and rangeTo for numberRange field
      if (checklistField === 'numberRange') {
        if (rangeFrom !== undefined && typeof rangeFrom !== 'number') {
          return NextResponse.json({ error: 'rangeFrom must be a number' }, { status: 400 });
        }
        if (rangeTo !== undefined && typeof rangeTo !== 'number') {
          return NextResponse.json({ error: 'rangeTo must be a number' }, { status: 400 });
        }
        if (rangeFrom !== undefined && rangeTo !== undefined && rangeFrom > rangeTo) {
          return NextResponse.json({ error: 'rangeFrom must be less than or equal to rangeTo' }, { status: 400 });
        }
      }
    }

    const updatedChecklist: any = {
      _id: existingChecklist._id || new mongoose.Types.ObjectId(checklistId),
      type: existingChecklist.type,
      name: name !== undefined ? name.trim() : existingChecklist.name,
      field: existingChecklist.type === 'status' ? (field || existingChecklist.field) : undefined,
      location: existingChecklist.type === 'status' ? (location !== undefined ? (location?.trim() || undefined) : existingChecklist.location) : undefined,
      comment: comment !== undefined ? (comment || undefined) : existingChecklist.comment,
      defaultChecked: defaultChecked !== undefined ? defaultChecked : existingChecklist.defaultChecked,
      answerChoices: answerChoices !== undefined ? (answerChoices && Array.isArray(answerChoices) ? answerChoices : undefined) : existingChecklist.answerChoices,
      orderIndex: orderIndex !== undefined ? orderIndex : existingChecklist.orderIndex,
    };

    // Add answer fields if provided
    if (textAnswer !== undefined) {
      updatedChecklist.textAnswer = textAnswer?.trim() || undefined;
    } else if (existingChecklist.textAnswer !== undefined) {
      updatedChecklist.textAnswer = existingChecklist.textAnswer;
    }
    
    if (selectedAnswers !== undefined) {
      updatedChecklist.selectedAnswers = Array.isArray(selectedAnswers) && selectedAnswers.length > 0 ? selectedAnswers : undefined;
    } else if (existingChecklist.selectedAnswers !== undefined) {
      updatedChecklist.selectedAnswers = existingChecklist.selectedAnswers;
    }
    
    if (dateAnswer !== undefined) {
      updatedChecklist.dateAnswer = dateAnswer ? new Date(dateAnswer) : undefined;
    } else if (existingChecklist.dateAnswer !== undefined) {
      updatedChecklist.dateAnswer = existingChecklist.dateAnswer;
    }
    
    if (numberAnswer !== undefined) {
      updatedChecklist.numberAnswer = numberAnswer !== null && numberAnswer !== undefined ? numberAnswer : undefined;
    } else if (existingChecklist.numberAnswer !== undefined) {
      updatedChecklist.numberAnswer = existingChecklist.numberAnswer;
    }
    
    if (numberUnit !== undefined) {
      updatedChecklist.numberUnit = numberUnit?.trim() || undefined;
    } else if (existingChecklist.numberUnit !== undefined) {
      updatedChecklist.numberUnit = existingChecklist.numberUnit;
    }
    
    if (rangeFrom !== undefined) {
      updatedChecklist.rangeFrom = rangeFrom !== null && rangeFrom !== undefined ? rangeFrom : undefined;
    } else if (existingChecklist.rangeFrom !== undefined) {
      updatedChecklist.rangeFrom = existingChecklist.rangeFrom;
    }
    
    if (rangeTo !== undefined) {
      updatedChecklist.rangeTo = rangeTo !== null && rangeTo !== undefined ? rangeTo : undefined;
    } else if (existingChecklist.rangeTo !== undefined) {
      updatedChecklist.rangeTo = existingChecklist.rangeTo;
    }
    
    if (rangeUnit !== undefined) {
      updatedChecklist.rangeUnit = rangeUnit?.trim() || undefined;
    } else if (existingChecklist.rangeUnit !== undefined) {
      updatedChecklist.rangeUnit = existingChecklist.rangeUnit;
    }

    // Update the checklist using arrayFilters
    await InspectionTemplate.updateOne(
      {
        _id: templateId,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $set: {
          'sections.$[section].subsections.$[subsection].checklists.$[checklist]': updatedChecklist,
        },
      },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
          { 'checklist._id': new mongoose.Types.ObjectId(checklistId) },
        ],
      }
    );

    // Fetch updated template to return the updated checklist
    const updatedTemplate = await InspectionTemplate.findById(templateId).lean();
    const updatedSection = updatedTemplate?.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );
    const updatedSubsection = updatedSection?.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );
    const updatedChecklistData = updatedSubsection?.checklists?.find(
      (c: any) => c._id && c._id.toString() === checklistId
    );

    return NextResponse.json(
      { message: 'Checklist updated successfully', checklist: updatedChecklistData },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Update inspection template checklist error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update inspection template checklist' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    await dbConnect();

    const currentUser = await getCurrentUser(request);
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { inspectionId, templateId, sectionId, subsectionId, checklistId } = await context.params;

    if (!mongoose.Types.ObjectId.isValid(inspectionId) || !mongoose.Types.ObjectId.isValid(templateId) || !mongoose.Types.ObjectId.isValid(sectionId) || !mongoose.Types.ObjectId.isValid(subsectionId) || !mongoose.Types.ObjectId.isValid(checklistId)) {
      return NextResponse.json({ error: 'Invalid inspection, template, section, subsection, or checklist ID' }, { status: 400 });
    }

    const template = await getAuthorizedInspectionTemplate(
      inspectionId,
      templateId,
      currentUser.company?.toString()
    );

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if section exists
    const section = template.sections?.find(
      (s: any) => s._id && s._id.toString() === sectionId
    );

    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    // Check if subsection exists
    const subsection = section.subsections?.find(
      (s: any) => s._id && s._id.toString() === subsectionId
    );

    if (!subsection) {
      return NextResponse.json({ error: 'Subsection not found' }, { status: 404 });
    }

    // Check if checklist exists
    const checklistExists = subsection.checklists?.some(
      (c: any) => c._id && c._id.toString() === checklistId
    );

    if (!checklistExists) {
      return NextResponse.json({ error: 'Checklist not found' }, { status: 404 });
    }

    // Remove the checklist from the array using arrayFilters
    await InspectionTemplate.updateOne(
      {
        _id: templateId,
        'sections._id': new mongoose.Types.ObjectId(sectionId),
      },
      {
        $pull: {
          'sections.$[section].subsections.$[subsection].checklists': { _id: new mongoose.Types.ObjectId(checklistId) },
        },
      },
      {
        arrayFilters: [
          { 'section._id': new mongoose.Types.ObjectId(sectionId) },
          { 'subsection._id': new mongoose.Types.ObjectId(subsectionId) },
        ],
      }
    );

    return NextResponse.json(
      { message: 'Checklist deleted successfully' },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Delete inspection template checklist error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete inspection template checklist' },
      { status: 500 }
    );
  }
}
