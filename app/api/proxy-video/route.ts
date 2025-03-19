import { NextRequest, NextResponse } from 'next/server';

// Add this type extension to the top of your file
interface ExtendedRequestInit extends RequestInit {
    duplex?: 'half';
}

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

        // Use the extended type
        const requestInit: ExtendedRequestInit = {
            method: 'POST',
            body: request.body,
            headers: {
                ...(request.headers.get('content-type') ?
                    {'Content-Type': request.headers.get('content-type')!} : {})
            },
            duplex: 'half'
        };

        // Forward the request to your backend server
        const response = await fetch(`${backendUrl}/api/process-video`, requestInit);

        // Rest of your code remains the same
        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText };
            }
            return NextResponse.json(
                { error: errorData.error || 'Backend processing failed' },
                { status: response.status }
            );
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