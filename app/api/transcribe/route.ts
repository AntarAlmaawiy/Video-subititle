// app/api/transcibe/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/ai/openai';
import { extractAudio, downloadVideo } from '@/lib/video-processing/ffmpeg';

export async function POST(request: NextRequest) {
    try {
        // Get FormData from request
        const formData = await request.formData();
        const videoFile = formData.get('video') as File;
        const videoUrl = formData.get('videoUrl') as string;
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';

        let audioBuffer: ArrayBuffer;

        if (videoFile) {
            // Extract audio from uploaded file
            const videoBuffer = await videoFile.arrayBuffer();
            audioBuffer = await extractAudio(videoBuffer);
        } else if (videoUrl) {
            // Download video and extract audio
            const videoBuffer = await downloadVideo(videoUrl);
            audioBuffer = await extractAudio(videoBuffer);
        } else {
            return NextResponse.json({ error: 'No video provided' }, { status: 400 });
        }

        // Transcribe audio
        const transcription = await transcribeAudio(audioBuffer, sourceLanguage);

        return NextResponse.json({ success: true, transcription });
    } catch (error: any) {
        console.error('Transcription error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const config = {
    api: {
        bodyParser: false,
        responseLimit: '50mb',
    },
};