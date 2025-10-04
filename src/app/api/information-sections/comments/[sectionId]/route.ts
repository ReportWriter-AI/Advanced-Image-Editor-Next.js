import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// GET /api/information-sections/comments/[sectionId] - Get all comments for a section
export async function GET(
  request: NextRequest,
  { params }: { params: { sectionId: string } }
) {
  try {
    const { sectionId } = params;
    
    if (!ObjectId.isValid(sectionId)) {
      return NextResponse.json(
        { error: 'Invalid section ID' },
        { status: 400 }
      );
    }

    const db = await connectDB();

    const comments = await db.collection('section_comments')
      .find({ section_id: sectionId })
      .sort({ order_index: 1 })
      .toArray();

    return NextResponse.json({ comments });
  } catch (error) {
    console.error('Error fetching section comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch section comments' },
      { status: 500 }
    );
  }
}