// In app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
    runtime: 'edge',
};

export async function POST(request: NextRequest): Promise<Response> {
    try {
        // Get form data
        const formData = await request.formData();

        // Add debugging information
        console.log("Received file:", formData.get('video'));

        // Instead of example.com, use your actual server URL
        const serverBaseUrl = "http://159.89.123.141:3001/temp";

        // Generate unique filenames for mock content
        const timestamp = Date.now();
        const videoUrl = `${serverBaseUrl}/sample-${timestamp}.mp4`;
        const srtUrl = `${serverBaseUrl}/sample-${timestamp}.srt`;

        return NextResponse.json({
            success: true,
            videoUrl: videoUrl,
            srtUrl: srtUrl,
            transcription: "This is a sample transcription. The real processing would happen on your backend server.",
        });
    } catch (error: unknown) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}