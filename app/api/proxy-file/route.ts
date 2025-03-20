// app/api/proxy-file/route.ts
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
    try {
        const url = request.nextUrl.searchParams.get('path');

        if (!url) {
            return new Response('Missing path parameter', { status: 400 });
        }

        // Fetch the file from your backend
        const response = await fetch(url);

        if (!response.ok) {
            return new Response(`Failed to fetch file: ${response.status} ${response.statusText}`, {
                status: response.status
            });
        }

        // Get the content type
        const contentType = response.headers.get('content-type') || 'application/octet-stream';

        // Return the file with the same content type
        const blob = await response.blob();
        return new Response(blob, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': 'inline'
            }
        });
    } catch (error) {
        console.error('Error proxying file:', error);
        return new Response('Error fetching file', { status: 500 });
    }
}