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

        // This is a temporary mock response for testing
        return NextResponse.json({
            success: true,
            videoUrl: "https://example.com/sample.mp4", // Mock URL
            srtUrl: "https://example.com/sample.srt", // Mock URL
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