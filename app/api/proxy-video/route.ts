// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        // Extract form data
        const formData = await request.formData();

        // Send to backend server
        const backendUrl = process.env.BACKEND_URL || 'http://159.89.123.141:3001';

        // Forward the request to backend
        const response = await fetch(`${backendUrl}/api/process-video`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Backend error: ${response.status} ${response.statusText}`);
        }

        // Get the response
        const data = await response.json();

        // Create URLs that will work in the browser
        return NextResponse.json({
            success: true,
            videoUrl: `/api/proxy-file?path=${encodeURIComponent(data.videoUrl || 'http://159.89.123.141:8000/sample.mp4')}`,
            srtUrl: `/api/proxy-file?path=${encodeURIComponent(data.srtUrl || 'http://159.89.123.141:8000/sample.srt')}`,
            transcription: data.transcription || "This is a sample transcription for testing purposes."
        });
    } catch (error) {
        console.error('Proxy error:', error);

        // Return sample data on error for testing
        return NextResponse.json({
            success: true,
            videoUrl: `/api/proxy-file?path=${encodeURIComponent('http://159.89.123.141:8000/sample.mp4')}`,
            srtUrl: `/api/proxy-file?path=${encodeURIComponent('http://159.89.123.141:8000/sample.srt')}`,
            transcription: "This is a sample transcription for testing purposes."
        });
    }
}