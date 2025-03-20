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

        // Create a ReadableStream to stream the backend response
        const { readable, writable } = new TransformStream();

        // Clone the request to forward it
        const clonedRequest = request.clone();

        // Get the content type
        const contentType = request.headers.get('content-type');

        // Start the fetch to the backend
        fetch(`${backendUrl}/api/process-video`, {
            method: 'POST',
            body: clonedRequest.body,
            headers: {
                ...(contentType ? {'Content-Type': contentType} : {})
            },
            // Using the correct approach - omit the duplex property entirely
        }).then(async response => {
            if (!response.body) {
                writable.getWriter().close();
                return;
            }

            // Stream each chunk from backend to client
            const reader = response.body.getReader();
            const writer = writable.getWriter();

            async function pump(): Promise<void> {
                try {
                    while (true) {
                        const { done, value } = await reader.read();

                        if (done) {
                            await writer.close();
                            break;
                        }

                        await writer.write(value);
                    }
                } catch (e) {
                    console.error("Error in pump:", e);
                    await writer.close();
                }
            }

            // Start pumping data
            pump().catch(err => {
                console.error("Error in pump promise:", err);
            });
        }).catch(err => {
            console.error("Error streaming response:", err);
            // Close the writer in case of error
            writable.getWriter().close();
        });

        // Return a streaming response
        return new Response(readable, {
            headers: {
                'Content-Type': 'application/json',
            }
        });
    } catch (error: unknown) {
        console.error('Proxy error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
            { status: 500 }
        );
    }
}