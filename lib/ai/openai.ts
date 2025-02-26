// lib/ai/openai.ts
import OpenAI from 'openai';

// Initialize the OpenAI client
export const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function to transcribe audio using Whisper API
export async function transcribeAudio(audioBuffer: ArrayBuffer, language: string = 'auto') {
    try {
        const file = new Blob([audioBuffer], { type: 'audio/mp3' });

        // Create a File object from Blob
        const audioFile = new File([file], 'audio.mp3', { type: 'audio/mp3' });

        const response = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: language !== 'auto' ? language : undefined,
            response_format: 'verbose_json', // Get timestamps for subtitles
        });

        return response;
    } catch (error) {
        console.error('Transcription error:', error);
        throw new Error('Failed to transcribe audio');
    }
}

// Function to translate text
export async function translateText(text: string, sourceLanguage: string, targetLanguage: string) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `You are a professional translator. Translate the provided text from ${sourceLanguage} to ${targetLanguage}. Maintain the original meaning, tone, and formatting. Return only the translated text without additional explanations.`
                },
                {
                    role: 'user',
                    content: text
                }
            ],
            temperature: 0.2, // Lower temperature for more consistent translations
        });

        return response.choices[0]?.message?.content || '';
    } catch (error) {
        console.error('Translation error:', error);
        throw new Error('Failed to translate text');
    }
}

// Format transcriptions into SRT format
export function formatToSRT(segments: any[]) {
    let srtContent = '';

    segments.forEach((segment, index) => {
        const startTime = formatSRTTime(segment.start);
        const endTime = formatSRTTime(segment.end);

        // SRT format: index, timestamp range, text, empty line
        srtContent += `${index + 1}\n`;
        srtContent += `${startTime} --> ${endTime}\n`;
        srtContent += `${segment.text.trim()}\n\n`;
    });

    return srtContent;
}

// Helper function to format time for SRT (00:00:00,000)
function formatSRTTime(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}