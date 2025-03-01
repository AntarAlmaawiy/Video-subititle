// app/api/embed-subtitles/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processVideoWithSubtitles } from '@/lib/video-processing/subtitle-embedder';
import crypto from 'crypto';

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
        const videoFile = formData.get('video') as File;
        const videoUrl = formData.get('videoUrl') as string;
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';
        const targetLanguage = formData.get('targetLanguage') as string;

        let result;

        if (videoFile) {
            // Process uploaded file
            const videoBuffer = await videoFile.arrayBuffer();
            result = await processVideoWithSubtitles(
                videoBuffer,
                'file',
                sourceLanguage,
                targetLanguage
            );
        } else if (videoUrl) {
            // Process video from URL
            result = await processVideoWithSubtitles(
                videoUrl,
                'link',
                sourceLanguage,
                targetLanguage
            );
        } else {
            return NextResponse.json({ error: 'No video provided' }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            videoUrl: result.videoUrl,
            srtUrl: `/api/subtitles/${crypto.randomBytes(8).toString('hex')}.srt`, // This would typically be a real URL to the SRT file
            transcription: result.transcription,
            translation: result.translation,
        });
    } catch (error: any) {
        console.error('Subtitle embedding error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

