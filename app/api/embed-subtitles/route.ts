// app/api/embed-subtitles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processVideoWithSubtitles } from '@/lib/video-processing/subtitle-embedder';
import crypto from 'crypto';

export const config = {
    api: {
        bodyParser: false, // Handle file uploads manually
        responseLimit: '100mb',
    },
};

export async function POST(request: NextRequest) {
    try {
        // Parse the form data
        const formData = await request.formData();

        // Get parameters
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';
        const targetLanguage = formData.get('targetLanguage') as string;

        if (!targetLanguage) {
            return NextResponse.json({ error: 'Target language is required' }, { status: 400 });
        }

        // Get video source (file or URL)
        const videoFile = formData.get('video') as File;
        const videoUrl = formData.get('videoUrl') as string;

        if (!videoFile && !videoUrl) {
            return NextResponse.json({ error: 'No video provided' }, { status: 400 });
        }

        // Process based on source type
        let result;
        if (videoFile) {
            const videoBuffer = await videoFile.arrayBuffer();
            result = await processVideoWithSubtitles(
                videoBuffer,
                'file',
                sourceLanguage,
                targetLanguage
            );
        } else if (videoUrl) {
            result = await processVideoWithSubtitles(
                videoUrl,
                'link',
                sourceLanguage,
                targetLanguage
            );
        } else {
            return NextResponse.json({ error: 'Invalid video source' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            videoUrl: result.videoUrl,
            srtUrl: `/api/subtitles/${crypto.randomBytes(8).toString('hex')}.srt`, // In a real app, upload SRT to storage
            transcription: result.transcription,
            translation: result.translation,
        });
    } catch (error: any) {
        console.error('Subtitle embedding API error:', error);
        return NextResponse.json({ error: error.message || 'Failed to embed subtitles' }, { status: 500 });
    }
}