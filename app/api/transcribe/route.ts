// app/api/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { transcribeAudio } from '@/lib/ai/openai';
import { extractAudio, downloadVideo } from '@/lib/video-processing/ffmpeg';

export const config = {
    api: {
        bodyParser: false, // Handle file uploads manually
        responseLimit: '50mb',
    },
};

export async function POST(request: NextRequest) {
    try {
        // Check for multipart/form-data
        const contentType = request.headers.get('content-type') || '';

        if (!contentType.includes('multipart/form-data')) {
            return NextResponse.json({ error: 'Invalid content type' }, { status: 400 });
        }

        // Parse the form data
        const formData = await request.formData();

        // Get source language
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';

        // Get video source (file or URL)
        const videoFile = formData.get('video') as File;
        const videoUrl = formData.get('videoUrl') as string;

        if (!videoFile && !videoUrl) {
            return NextResponse.json({ error: 'No video provided' }, { status: 400 });
        }

        let audioBuffer: ArrayBuffer;

        // Process based on source type
        if (videoFile) {
            // Extract audio from uploaded file
            const videoBuffer = await videoFile.arrayBuffer();
            audioBuffer = await extractAudio(videoBuffer);
        } else if (videoUrl) {
            // Download video from URL and extract audio
            const videoBuffer = await downloadVideo(videoUrl);
            audioBuffer = await extractAudio(videoBuffer);
        } else {
            return NextResponse.json({ error: 'Invalid video source' }, { status: 400 });
        }

        // Transcribe the audio
        const transcription = await transcribeAudio(audioBuffer, sourceLanguage);

        return NextResponse.json({
            success: true,
            transcription,
        });
    } catch (error: any) {
        console.error('Transcription API error:', error);
        return NextResponse.json({ error: error.message || 'Failed to transcribe video' }, { status: 500 });
    }
}