// lib/video-processing/subtitle-embedder.ts
import { extractAudio, embedSubtitles, downloadVideo, saveProcessedVideo } from './ffmpeg';
import { transcribeAudio, translateText, formatToSRT } from '../ai/openai';

interface SubtitleProcessingResult {
    videoUrl: string;
    srtContent: string;
    transcription: string;
    translation: string;
}

// Import types from OpenAI
import type { TranscriptionSegment as OpenAITranscriptionSegment } from 'openai/resources/audio/transcriptions';

// Define a type for the transcription result that works with OpenAI's return type
type TranscriptionResult = {
    text: string;
    segments?: OpenAITranscriptionSegment[];
    [key: string]: unknown;
}

/**
 * Process a video by transcribing audio, translating, and embedding subtitles
 * @param videoSource Video buffer or URL
 * @param sourceType Type of source: 'file' or 'link'
 * @param sourceLanguage Source language code
 * @param targetLanguage Target language code
 * @param onProgress Progress callback function
 * @returns Processing result with video URL and subtitle content
 */
export async function processVideoWithSubtitles(
    videoSource: ArrayBuffer | string,
    sourceType: 'file' | 'link',
    sourceLanguage: string,
    targetLanguage: string,
    onProgress?: (progress: number, stage: string) => void
): Promise<SubtitleProcessingResult> {
    try {
        // Step 1: Get video buffer (from file or URL)
        onProgress?.(10, 'loading');
        let videoBuffer: ArrayBuffer;

        if (sourceType === 'link') {
            videoBuffer = await downloadVideo(videoSource as string);
        } else {
            videoBuffer = videoSource as ArrayBuffer;
        }

        // Step 2: Extract audio from video
        onProgress?.(20, 'extracting');
        const audioBuffer = await extractAudio(videoBuffer);

        // Step 3: Transcribe audio
        onProgress?.(30, 'transcribing');
        const transcriptionResult = await transcribeAudio(audioBuffer, sourceLanguage) as unknown as TranscriptionResult;
        const transcription = transcriptionResult.text;

        // Step 4: Translate transcription
        onProgress?.(50, 'translating');
        const translatedText = await translateText(transcription, sourceLanguage, targetLanguage);

        // Step 5: Format subtitles for SRT (with aligned timestamps)
        onProgress?.(70, 'formatting');

        // Create SRT content from the segments with translated text
        // This assumes transcriptionResult has segments with start/end times
        const segments = (transcriptionResult.segments || []).map((segment, index: number) => {
            const lines = translatedText.split('\n');
            // Map each original segment to a translated one
            // This is a simple approach - a more sophisticated one would align sentences
            return {
                ...segment,
                text: lines[index] || segment.text // Fallback to original if no translation available
            };
        });

        const srtContent = formatToSRT(segments);

        // Step 6: Embed subtitles into video
        onProgress?.(80, 'embedding');
        const processedVideoBuffer = await embedSubtitles(videoBuffer, srtContent);

        // Step 7: Save processed video and get URL
        onProgress?.(90, 'saving');
        // Save processed video and get URL
        const videoUrl = await saveProcessedVideo(processedVideoBuffer);

        // Complete
        onProgress?.(100, 'completed');

        return {
            videoUrl,
            srtContent,
            transcription,
            translation: translatedText,
        };
    } catch (error) {
        console.error('Video processing error:', error);
        throw new Error('Failed to process video with subtitles');
    }
}