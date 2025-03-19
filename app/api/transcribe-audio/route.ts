// app/api/transcribe-audio-audio/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/ai/openai';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: '100mb',
    },
};

export async function POST(request: NextRequest) {
    try {
        // Get FormData from request
        const formData = await request.formData();
        const audioFile = formData.get('audio') as File;
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';

        if (!audioFile) {
            return NextResponse.json({ error: 'No audio provided' }, { status: 400 });
        }

        // Check file size
        if (audioFile.size > 25 * 1024 * 1024) { // 25MB limit for OpenAI's Whisper API
            return NextResponse.json({ error: 'Audio file exceeds 25MB limit' }, { status: 400 });
        }

        // Convert to ArrayBuffer
        const audioBuffer = await audioFile.arrayBuffer();

        // Transcribe audio directly without FFmpeg processing
        const transcription = await transcribeAudio(audioBuffer, sourceLanguage);

        return NextResponse.json({ success: true, transcription });
    } catch (error: unknown) {
        console.error('Transcription error:', error);
        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'An unexpected error occurred'},
            { status: 500 }
        );
    }
}