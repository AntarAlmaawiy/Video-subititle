// lib/video-processing/ffmpeg.ts
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';

// Initialize FFmpeg with required memory
const ffmpeg = createFFmpeg({
    log: true,
    corePath: '/ffmpeg-core.js' // Ensure you host this file in your public directory
});

// Load FFmpeg if not already loaded
let ffmpegLoaded = false;
async function loadFFmpeg() {
    if (!ffmpegLoaded) {
        await ffmpeg.load();
        ffmpegLoaded = true;
    }
}

/**
 * Extract audio from video file
 * @param videoBuffer Video file as ArrayBuffer
 * @returns Audio file as ArrayBuffer
 */
export async function extractAudio(videoBuffer: ArrayBuffer): Promise<ArrayBuffer> {
    await loadFFmpeg();

    // Write input file to memory
    ffmpeg.FS('writeFile', 'input.mp4', new Uint8Array(videoBuffer));

    // Extract audio using FFmpeg
    await ffmpeg.run(
        '-i', 'input.mp4',
        '-vn', // No video
        '-acodec', 'libmp3lame', // MP3 codec
        '-ar', '44100', // Sample rate
        '-ac', '2', // Stereo audio
        '-q:a', '2', // Quality
        'output.mp3'
    );

    // Read the output file
    const data = ffmpeg.FS('readFile', 'output.mp3');

    // Clean up
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'output.mp3');

    return data.buffer;
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
    await loadFFmpeg();

    // Write input files to memory
    ffmpeg.FS('writeFile', 'input.mp4', new Uint8Array(videoBuffer));
    ffmpeg.FS('writeFile', 'subtitles.srt', new TextEncoder().encode(subtitlesContent));

    // Embed subtitles into video
    await ffmpeg.run(
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
    );

    // Read the output file
    const data = ffmpeg.FS('readFile', 'output.mp4');

    // Clean up
    ffmpeg.FS('unlink', 'input.mp4');
    ffmpeg.FS('unlink', 'subtitles.srt');
    ffmpeg.FS('unlink', 'output.mp4');

    return data.buffer;
}

/**
 * Download a video from a URL
 * @param url Video URL
 * @returns Video file as ArrayBuffer
 */
export async function downloadVideo(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
    }

    const blob = await response.blob();
    return await blob.arrayBuffer();
}

/**
 * Save video to server and return a URL
 * This is a placeholder - in a real app you would upload to cloud storage
 * @param videoBuffer Video file as ArrayBuffer
 * @param filename Output filename
 * @returns URL to the saved video
 */
export async function saveProcessedVideo(videoBuffer: ArrayBuffer, filename: string): Promise<string> {
    // In a real app, you would upload to cloud storage (AWS S3, Google Cloud Storage, etc.)
    // For this example, we'll return a placeholder URL
    // You'll need to implement actual file storage logic

    // Simulated upload delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Return a placeholder URL - replace with actual upload logic
    return `/api/videos/${filename}`;
}