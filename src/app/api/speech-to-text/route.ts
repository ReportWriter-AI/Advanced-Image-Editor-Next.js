// route.ts
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio file provided' }, { status: 400 });
    }

    const fileName = audioFile.name?.endsWith('.webm') ? audioFile.name : 'audio.webm';
    const fileToSend =
      audioFile.name === fileName
        ? audioFile
        : new File([audioFile], fileName, { type: audioFile.type || 'audio/webm' });

    const prompt =
      [
        'Transcribe ONLY the words spoken by the user.',
        'Generate only English text.',
        'Do NOT add any extra text, URLs, disclaimers, slogans, or advice.',
        'Do NOT infer missing words. If you are unsure, omit that part.',
        '',
      ].join(' ');

    const transcription = await openai.audio.transcriptions.create({
      file: fileToSend,

      model: 'gpt-4o-mini-transcribe-2025-12-15',

      language: 'en',
      prompt,
      temperature: 0,
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error: any) {
    console.error('Speech-to-text error:', error);
    return NextResponse.json(
      { error: 'Failed to transcribe audio', message: error?.message || 'Failed to transcribe audio' },
      { status: 500 }
    );
  }
}
