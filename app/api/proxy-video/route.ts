import { NextRequest, NextResponse } from 'next/server';

export const config = {
    api: {
        // These are Next.js config options
        bodyParser: false, // We'll handle the body manually to forward it
        responseLimit: '50mb', // Allow large responses for video data
    },
};

export async function POST(request: NextRequest) {
    try {
        // Get the backend URL from environment variables
        const backendUrl = process.env.VIDEO_PROCESSING_API;

        if (!backendUrl) {
            return NextResponse.json(
                { error: 'Backend API URL not configured' },
                { status: 500 }
            );
        }

        // Forward the request to your backend server
        const response = await fetch(`${backendUrl}/api/process-video`, {
            method: 'POST',
            body: request.body, // Forward the body as-is
            headers: {
                // Forward relevant headers
                'Content-Type': request.headers.get('content-type') || 'application/json',
            },
        });

        if (!response.ok) {
            const errorData = await response.json();
            return NextResponse.json({ error: errorData.error || 'Backend processing failed' }, { status: response.status });
        }

        // Return the response from your backend
        const data = await response.json();
        return NextResponse.json(data);

    } catch (error: unknown) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}