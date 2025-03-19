// lib/video-processing/ffmpeg.ts
import { FFmpeg } from '@ffmpeg/ffmpeg';

// Type for FFmpeg readFile return
type FFmpegFileData = Uint8Array | string;

// Create a singleton instance of FFmpeg
let ffmpegInstance: FFmpeg | null = null;

// Load FFmpeg if not already loaded
async function getFFmpeg(): Promise<FFmpeg> {
    if (ffmpegInstance) {
        return ffmpegInstance;
    }

    // Create new instance
    ffmpegInstance = new FFmpeg();

    // Load FFmpeg
    if (!ffmpegInstance.loaded) {
        try {
            // Load from UNPKG CDN
            await ffmpegInstance.load({
                coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
                wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
            });

            console.log('FFmpeg loaded successfully');
        } catch (error) {
            console.error('Failed to load FFmpeg:', error);
            throw new Error('Failed to load FFmpeg');
        }
    }

    return ffmpegInstance;
}

/**
 * Convert FFmpeg file data to ArrayBuffer
 */
function fileDataToArrayBuffer(data: FFmpegFileData): ArrayBuffer {
    if (typeof data === 'string') {
        // Create a new ArrayBuffer from the encoded data to ensure proper type
        const encoded = new TextEncoder().encode(data);
        const buffer = new ArrayBuffer(encoded.byteLength);
        new Uint8Array(buffer).set(encoded);
        return buffer;
    }

    // It's a Uint8Array, create a new ArrayBuffer to ensure proper type
    const buffer = new ArrayBuffer(data.byteLength);
    new Uint8Array(buffer).set(data);
    return buffer;
}

/**
 * Extract audio from video file
 * @param videoBuffer Video file as ArrayBuffer
 * @returns Audio file as ArrayBuffer
 */
export async function extractAudio(videoBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    const ffmpeg = await getFFmpeg();

    try {
        // Write input file to memory
        await ffmpeg.writeFile('input.mp4', new Uint8Array(videoBuffer));

        // Extract audio using FFmpeg
        await ffmpeg.exec([
            '-i', 'input.mp4',
            '-vn', // No video
            '-acodec', 'libmp3lame', // MP3 codec
            '-ar', '44100', // Sample rate
            '-ac', '2', // Stereo audio
            '-q:a', '2', // Quality
            'output.mp3'
        ]);

        // Read the output file
        const data = await ffmpeg.readFile('output.mp3');

        // Clean up
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('output.mp3');

        return fileDataToArrayBuffer(data as FFmpegFileData);
    } catch (error) {
        console.error('Error extracting audio:', error);
        throw new Error('Failed to extract audio from video');
    }
}

/**
 * Embed subtitles into video
 * @param videoBuffer Video file as ArrayBuffer
 * @param subtitlesContent SRT content as string
 * @returns Processed video with subtitles as ArrayBuffer
 */
export async function embedSubtitles(
    videoBuffer: ArrayBuffer,
    subtitlesContent: string
): Promise<ArrayBuffer> {
    const ffmpeg = await getFFmpeg();

    try {
        // Write input files to memory
        await ffmpeg.writeFile('input.mp4', new Uint8Array(videoBuffer));

        // Create proper ArrayBuffer for subtitles
        const subtitlesEncoded = new TextEncoder().encode(subtitlesContent);
        await ffmpeg.writeFile('subtitles.srt', subtitlesEncoded);

        // Embed subtitles into video
        await ffmpeg.exec([
            '-i', 'input.mp4',
            '-i', 'subtitles.srt',
            '-c:v', 'libx264', // Video codec
            '-c:a', 'aac', // Audio codec
            '-map', '0:v', // Map video from first input
            '-map', '0:a', // Map audio from first input
            '-map', '1', // Map subtitles from second input
            '-c:s', 'mov_text', // Subtitle codec for MP4
            '-metadata:s:s:0', `language=${subtitlesContent.length > 0 ? 'eng' : 'und'}`, // Set subtitle language
            '-crf', '23', // Quality (lower is better)
            '-preset', 'fast', // Encoding speed
            'output.mp4'
        ]);

        // Read the output file
        const data = await ffmpeg.readFile('output.mp4');

        // Clean up
        await ffmpeg.deleteFile('input.mp4');
        await ffmpeg.deleteFile('subtitles.srt');
        await ffmpeg.deleteFile('output.mp4');

        return fileDataToArrayBuffer(data as FFmpegFileData);
    } catch (error) {
        console.error('Error embedding subtitles:', error);
        throw new Error('Failed to embed subtitles into video');
    }
}

/**
 * Download a video from a URL
 * @param url Video URL
 * @returns Video file as ArrayBuffer
 */
export async function downloadVideo(url: string): Promise<ArrayBuffer> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch video: ${response.statusText}`);
        }

        const blob = await response.blob();
        return await blob.arrayBuffer();
    } catch (error) {
        console.error('Error downloading video:', error);
        throw new Error('Failed to download video from URL');
    }
}

/**
 * Save video to server and return a URL
 * This is a placeholder - in a real app you would upload to cloud storage
 * @param videoBuffer Video file as ArrayBuffer
 * @returns URL to the saved video
 */
export async function saveProcessedVideo(videoBuffer: ArrayBuffer): Promise<string> {
    // In a real app, you would upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
    // For development, we'll create a blob URL for the browser
    const blob = new Blob([videoBuffer], { type: 'video/mp4' });
    const url = URL.createObjectURL(blob);

    // In production, you'd upload to a storage service and return a permanent URL
    return url;
}