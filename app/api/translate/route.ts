// app/api/translate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/ai/openai';

export const config = {
    api: {
        bodyParser: false,
        responseLimit: '100mb',
    },
};

export async function POST(request: NextRequest) {
    try {
        const { text, sourceLanguage, targetLanguage } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        // Translate text
        const translation = await translateText(text, sourceLanguage, targetLanguage);

        return NextResponse.json({ success: true, translation });
    } catch (error: unknown) {
        console.error('Translation error:', error);
        return NextResponse.json(
            {error: error instanceof Error ? error.message : 'An unexpected error occurred'},
            { status: 500 }
        );
    }
}