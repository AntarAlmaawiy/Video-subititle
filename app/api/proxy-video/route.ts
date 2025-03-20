// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Get the form data
        const formData = await request.formData();

        // Extract the video file (disable ESLint warnings since we're not using these yet)
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const videoFile = formData.get('video') as File;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const sourceLanguage = formData.get('sourceLanguage') as string;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const targetLanguage = formData.get('targetLanguage') as string;

        // Log that we received the upload (helpful for debugging)
        console.log(`Video upload received: ${videoFile.name}, size: ${videoFile.size}, source: ${sourceLanguage}, target: ${targetLanguage}`);

        // Generate a unique job ID
        const jobId = Date.now().toString();

        // Return immediately with a job ID
        return NextResponse.json({
            success: true,
            message: 'Video upload received, processing started',
            jobId: jobId,
            // Provide mock/sample URLs
            videoUrl: '/sample.mp4',  // From public folder
            srtUrl: '/sample.srt',    // From public folder
            transcription: "This is a sample transcription for testing purposes."
        });
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}