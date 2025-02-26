// app/api/translate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { translateText } from '@/lib/ai/openai';

export async function POST(request: NextRequest) {
    try {
        const { text, sourceLanguage, targetLanguage } = await request.json();

        if (!text) {
            return NextResponse.json({ error: 'No text provided' }, { status: 400 });
        }

        if (!targetLanguage) {
            return NextResponse.json({ error: 'No target language provided' }, { status: 400 });
        }

        // Translate the text
        const translation = await translateText(text, sourceLanguage || 'auto', targetLanguage);

        return NextResponse.json({
            success: true,
            translation,
        });
    } catch (error: any) {
        console.error('Translation API error:', error);
        return NextResponse.json({ error: error.message || 'Failed to translate text' }, { status: 500 });
    }
}