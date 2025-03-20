// app/api/proxy-video/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
    runtime: 'edge',
};

export async function POST(request: NextRequest): Promise<Response> {
    try {
        const backendUrl = process.env.VIDEO_PROCESSING_API;

        if (!backendUrl) {
            return NextResponse.json(
                { error: 'Backend API URL not configured' },
                { status: 500 }
            );
        }

        // Extract the FormData from the request
        const formData = await request.formData();

        // Create a new request to the backend
        const response = await fetch(`${backendUrl}/api/process-video`, {
            method: 'POST',
            body: formData,
            // No need for duplex property, just forward the request
        });

        // Read the response from the backend
        const responseText = await response.text();

        // Try to parse the response as JSON
        try {
            const jsonResponse = JSON.parse(responseText);
            return NextResponse.json(jsonResponse);
        } catch {
            // If it's not valid JSON, return the raw text
            return new Response(responseText, {
                status: response.status,
                headers: {
                    'Content-Type': 'text/plain',
                }
            });
        }
    } catch (error: unknown) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}