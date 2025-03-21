// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
    api: {
        bodyParser: false, // Don't parse the files, handle as a stream
        responseLimit: false, // No response size limit
    },
};

export async function POST(request: NextRequest) {
    try {
        // Get the form data
        const formData = await request.formData();

        console.log("Received form data, forwarding to backend...");

        // Forward the request to your backend
        const backendUrl = process.env.BACKEND_URL || 'http://159.89.123.141:3001';
        const response = await fetch(`${backendUrl}/api/process-video`, {
            method: 'POST',
            body: formData,
            // Don't set Content-Type here - fetch will set it with the correct boundary
        });

        if (!response.ok) {
            console.error(`Backend responded with status: ${response.status}`);
            const errorText = await response.text();
            throw new Error(`Backend API Error (${response.status}): ${errorText}`);
        }

        // Return the response from the backend API
        const responseData = await response.json();
        console.log("Processed video successfully, returning results");

        return NextResponse.json(responseData);
    } catch (error) {
        console.error('Proxy-video error:', error);
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : 'An unexpected error occurred',
                timestamp: new Date().toISOString(),
            },
            { status: 500 }
        );
    }
}