// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { processVideoWithSubtitles } from '@/lib/video-processing/subtitle-embedder';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export const config = {
    api: {
        bodyParser: false, // Don't parse the files, handle as a stream
        responseLimit: false, // No response size limit
    },
};

// Simple function to generate random ID (replacement for uuid)
function generateId(length = 12) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function POST(request: NextRequest) {
    try {
        // Get the form data
        const formData = await request.formData();
        const videoFile = formData.get('video') as File;
        const sourceLanguage = formData.get('sourceLanguage') as string || 'auto';
        const targetLanguage = formData.get('targetLanguage') as string || 'en';

        if (!videoFile) {
            return NextResponse.json({ error: 'No video file provided' }, { status: 400 });
        }

        console.log(`Processing video: ${videoFile.name}, size: ${(videoFile.size / (1024 * 1024)).toFixed(2)}MB`);

        // Convert the file to ArrayBuffer
        const videoBuffer = await videoFile.arrayBuffer();

        // Process the video using your existing function
        const result = await processVideoWithSubtitles(
            videoBuffer,
            'file',
            sourceLanguage,
            targetLanguage,
            (progress, stage) => {
                console.log(`Processing progress: ${progress}% (${stage})`);
            }
        );

        // Save the SRT content to a file and create a URL for it
        const baseDir = process.cwd();
        const publicDir = join(baseDir, 'public', 'processed');

        // Ensure the directory exists
        await mkdir(publicDir, { recursive: true });

        // Generate a unique filename using timestamp and random ID
        const timestamp = Date.now();
        const randomId = generateId(8);
        const srtFilename = `subtitles-${timestamp}-${randomId}.srt`;
        const srtPath = join(publicDir, srtFilename);

        // Write the SRT content to a file
        await writeFile(srtPath, result.srtContent);

        // Generate URL for the SRT file
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const srtUrl = `${baseUrl}/processed/${srtFilename}`;

        // Return the response with URLs
        return NextResponse.json({
            success: true,
            videoUrl: result.videoUrl,
            srtUrl: srtUrl,
            transcription: result.transcription
        });
    } catch (error) {
        console.error('Video processing error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}