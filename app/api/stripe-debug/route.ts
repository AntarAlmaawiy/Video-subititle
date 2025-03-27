// app/api/stripe-debug/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        // Log headers and body
        const body = await request.text();
        const headers = Object.fromEntries([...request.headers.entries()]);

        console.log('Debug webhook received:');
        console.log('Headers:', JSON.stringify(headers));
        console.log('Body preview:', body.substring(0, 200) + '...');

        // Always return success
        return NextResponse.json({ received: true, debug: true });
    } catch (error) {
        console.error('Debug webhook error:', error);
        return NextResponse.json({ error: 'Captured in debug endpoint' }, { status: 200 });
    }
}