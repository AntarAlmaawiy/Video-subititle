// server.js
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import cors from 'cors';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

// Use fileURLToPath for __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize environment variables
dotenv.config();

// For FFmpeg, we may need to use require since fluent-ffmpeg might not support ES modules fully
const require = createRequire(import.meta.url);
const ffmpeg = require('fluent-ffmpeg');

// Better FFmpeg path handling with fallbacks
try {
    // Check for common FFmpeg paths
    const possiblePaths = [
        '/usr/bin/ffmpeg',                // Linux
        '/usr/local/bin/ffmpeg',          // Mac (default)
        '/opt/homebrew/bin/ffmpeg',       // Mac (Homebrew on Apple Silicon)
        'C:\\ffmpeg\\bin\\ffmpeg.exe'     // Windows
    ];

    let ffmpegPath = null;
    for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
            ffmpegPath = path;
            break;
        }
    }

    if (!ffmpegPath) {
        console.warn('FFmpeg not found in common paths, trying to use system PATH');
        // Rely on system PATH as last resort
    } else {
        console.log('Using FFmpeg from:', ffmpegPath);
        ffmpeg.setFfmpegPath(ffmpegPath);
    }
} catch (error) {
    console.error('Error setting FFmpeg path:', error);
}

// Initialize OpenAI client
import { OpenAI } from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Log to confirm API key is loaded (don't include the full key in logs!)
const apiKeyStatus = process.env.OPENAI_API_KEY ?
    `Loaded (starts with: ${process.env.OPENAI_API_KEY.substring(0, 3)}...)` :
    'Missing - please check your .env file';
console.log('OpenAI API Key:', apiKeyStatus);

const app = express();
const port = process.env.PORT || 3001;

// Ensure temp directory exists
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
}

// Configure storage for temporary files only
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        cb(null, `${uuidv4()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

// Enable CORS with your frontend domains
app.use(cors({
    origin: [
        'https://www.sub0-translate.com',
        'https://video-subtitle-git-main-antaralmaawiys-projects.vercel.app',
        'https://video-subtitle-4pzak8swt-antaralmaawiys-projects.vercel.app'
    ],
    methods: ['GET', 'POST'],
    credentials: true,
    optionsSuccessStatus: 204
}));

app.use(express.json());

// Serve temporary files (they'll be cleaned up later)
app.use('/temp', express.static(tempDir));

// Add a root endpoint for testing
app.get('/', (req, res) => {
    res.send('Video processing server is running!');
});

// Add a test API endpoint
app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'API server is working!',
        serverTime: new Date().toISOString(),
        environment: {
            nodeVersion: process.version,
            platform: process.platform,
            apiKeyConfigured: !!process.env.OPENAI_API_KEY
        },
        endpoints: [
            { path: '/api/process-video', method: 'POST', description: 'Process an uploaded video file' },
            { path: '/api/test-openai', method: 'GET', description: 'Test OpenAI API connection' }
        ]
    });
});

// Test OpenAI connection endpoint
app.get('/api/test-openai', async (req, res) => {
    try {
        const completion = await openai.chat.completions.create({
            messages: [{ role: "system", content: "Hello, are you working?" }],
            model: "gpt-3.5-turbo",
        });

        res.json({
            success: true,
            message: 'OpenAI API is working!',
            response: completion.choices[0].message.content
        });
    } catch (error) {
        console.error('OpenAI API test error:', error);
        res.status(500).json({
            error: 'OpenAI API test failed',
            details: error.message
        });
    }
});

// API endpoint to process a YouTube video
app.post('/api/process-youtube', async (req, res) => {
    try {
        console.log('Received request to process YouTube video:', req.body);
        const { videoUrl } = req.body;

        if (!videoUrl) {
            return res.status(400).json({ error: 'No video URL provided' });
        }

        // For YouTube links, we'll tell the user to use direct file upload instead
        // since YouTube actively blocks scraping tools
        console.log('YouTube download is not reliable, returning instructional response');
        return res.status(400).json({
            error: 'YouTube video processing is currently unavailable due to YouTube restrictions. Please download the video manually and use the file upload option instead.'
        });
    } catch (error) {
        console.error('Error processing YouTube video:', error);
        let errorMessage = 'Error processing YouTube video. Please try uploading a file directly.';
        res.status(500).json({ error: errorMessage });
    }
});

// API endpoint to process an uploaded video
app.post('/api/process-video', upload.single('video'), async (req, res) => {
    let videoPath = '';
    let audioPath = '';
    let srtPath = '';
    let outputPath = '';

    try {
        console.log('Received request to process uploaded video');
        const videoFile = req.file;
        const { sourceLanguage = 'auto', targetLanguage = 'en' } = req.body;

        if (!videoFile) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        console.log('Processing file:', videoFile.originalname, 'Size:', (videoFile.size / (1024 * 1024)).toFixed(2), 'MB');

        const videoId = path.basename(videoFile.path, path.extname(videoFile.path));
        videoPath = videoFile.path;
        audioPath = path.join(tempDir, `${videoId}.mp3`);
        srtPath = path.join(tempDir, `${videoId}.srt`);
        outputPath = path.join(tempDir, `${videoId}-with-subtitles.mp4`);

        // Step 2: Extract audio from the video with optimized settings
        console.log('Extracting audio with optimized settings for transcription...');
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .output(audioPath)
                    .audioChannels(1) // Mono audio works better with Whisper
                    .audioFrequency(16000) // 16kHz is recommended for Whisper
                    .audioCodec('libmp3lame')
                    .audioBitrate('128k') // Higher bitrate for better quality
                    .toFormat('mp3')
                    .on('start', (commandLine) => {
                        console.log('FFmpeg command:', commandLine);
                    })
                    .on('progress', (progress) => {
                        console.log(`Audio extraction progress: ${progress.percent ? progress.percent.toFixed(1) : 'N/A'}%`);
                    })
                    .on('end', () => {
                        console.log('Audio extraction completed');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Audio extraction error:', err);
                        reject(new Error(`Failed to extract audio: ${err.message}`));
                    })
                    .run();
            });
        } catch (error) {
            throw new Error(`Audio extraction failed: ${error.message}`);
        }

        // Step 3: Transcribe the audio using Whisper API with better settings for accuracy
        console.log('Transcribing audio with Whisper API...');
        let transcriptionResponse;
        let retryCount = 0;
        const maxRetries = 3;

        while (retryCount < maxRetries) {
            try {
                // Ensure the audio file exists and is valid
                if (!fs.existsSync(audioPath)) {
                    throw new Error('Audio file does not exist');
                }

                const stats = fs.statSync(audioPath);
                if (stats.size === 0) {
                    throw new Error('Audio file is empty');
                }

                console.log(`Audio file size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

                // Create a file object for the OpenAI API
                const audioFile = fs.createReadStream(audioPath);

                // Make the API call with proper configuration
                transcriptionResponse = await openai.audio.transcriptions.create({
                    file: audioFile,
                    model: 'whisper-1',
                    language: sourceLanguage !== 'auto' ? sourceLanguage : undefined,
                    response_format: 'verbose_json',
                    timestamp_granularities: ["segment"],  // Get precise timestamps for subtitles
                    temperature: 0.0  // Use lowest temperature for most accurate transcription
                });

                console.log('Transcription completed successfully');
                break; // Success, exit the loop
            } catch (err) {
                retryCount++;
                console.error(`Transcription attempt ${retryCount} failed:`, err);

                if (retryCount >= maxRetries) {
                    throw new Error(`Failed to transcribe after ${maxRetries} attempts: ${err.message}`);
                }

                // Wait before retrying, increasing the wait time for each retry
                const waitTime = 3000 * retryCount;
                console.log(`Waiting ${waitTime/1000} seconds before retry ${retryCount + 1}...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }

        // Step 4: Translate if needed
        console.log('Processing transcription results...');
        if (!transcriptionResponse || !transcriptionResponse.text) {
            throw new Error('Transcription returned empty results');
        }

        // Check if we received segments for accurate timing
        const hasSegments = transcriptionResponse.segments && transcriptionResponse.segments.length > 0;
        console.log(`Received ${hasSegments ? transcriptionResponse.segments.length : 0} segments with timing information`);

        let finalText = transcriptionResponse.text;
        let translatedSegments = [];
        console.log('Transcription sample:', finalText.substring(0, 100) + '...');

        if (sourceLanguage !== targetLanguage && targetLanguage !== 'auto') {
            if (hasSegments) {
                // Translate each segment individually to preserve timing
                console.log(`Translating ${transcriptionResponse.segments.length} segments from ${sourceLanguage} to ${targetLanguage}...`);

                for (let i = 0; i < transcriptionResponse.segments.length; i++) {
                    const segment = transcriptionResponse.segments[i];
                    try {
                        const translationResponse = await openai.chat.completions.create({
                            model: 'gpt-3.5-turbo',
                            messages: [
                                {
                                    role: 'system',
                                    content: `You are a professional translator. Translate the provided text from ${sourceLanguage} to ${targetLanguage}. Maintain the original meaning and tone. Return only the translated text without additional explanations.`
                                },
                                {
                                    role: 'user',
                                    content: segment.text
                                }
                            ],
                            temperature: 0.2
                        });

                        const translatedText = translationResponse.choices[0]?.message?.content || segment.text;
                        translatedSegments.push({
                            ...segment,
                            text: translatedText
                        });

                        console.log(`Translated segment ${i+1}/${transcriptionResponse.segments.length}`);
                    } catch (err) {
                        console.error(`Error translating segment ${i+1}:`, err);
                        // On error, keep the original text
                        translatedSegments.push(segment);
                    }
                }

                // Also translate the full text for the final transcription
                const fullTranslationResponse = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a professional translator. Translate the provided text from ${sourceLanguage} to ${targetLanguage}. Maintain the original meaning, tone, and formatting. Return only the translated text without additional explanations.`
                        },
                        {
                            role: 'user',
                            content: finalText
                        }
                    ],
                    temperature: 0.2
                });

                finalText = fullTranslationResponse.choices[0]?.message?.content || finalText;
                console.log('Full translation completed successfully');
            } else {
                // Fallback to translating the entire text if no segments available
                console.log(`Translating full text from ${sourceLanguage} to ${targetLanguage}...`);

                const translationResponse = await openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a professional translator. Translate the provided text from ${sourceLanguage} to ${targetLanguage}. Maintain the original meaning, tone, and formatting. Return only the translated text without additional explanations.`
                        },
                        {
                            role: 'user',
                            content: finalText
                        }
                    ],
                    temperature: 0.2
                });

                finalText = translationResponse.choices[0]?.message?.content || finalText;
                console.log('Translation completed successfully');
            }
        } else {
            // If no translation needed, just copy the segments
            translatedSegments = transcriptionResponse.segments || [];
        }

        // Step 5: Create SRT file with proper timing
        console.log('Creating SRT file...');
        try {
            const segments = translatedSegments.length > 0 ? translatedSegments : transcriptionResponse.segments || [];
            let srtContent = '';

            segments.forEach((segment, index) => {
                const startTime = formatSRTTime(segment.start);
                const endTime = formatSRTTime(segment.end);

                srtContent += `${index + 1}\n`;
                srtContent += `${startTime} --> ${endTime}\n`;
                srtContent += `${segment.text.trim()}\n\n`;
            });

            fs.writeFileSync(srtPath, srtContent);
            console.log('SRT file created successfully');
        } catch (error) {
            throw new Error(`Failed to create SRT file: ${error.message}`);
        }

        // Step 6: Embed subtitles into video with refined styling (smaller, no background)
        console.log('Embedding refined subtitles...');
        try {
            // Escape the path for use in the subtitles filter
            const escapedSrtPath = srtPath.replace(/\\/g, '\\\\').replace(/:/g, '\\:');

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .outputOptions([
                        '-c:v libx264',       // Video codec
                        '-c:a aac',           // Audio codec
                        // Use the subtitles filter with refined styling - smaller text, no background
                        '-vf', `subtitles=${escapedSrtPath}:force_style='FontName=Arial,FontSize=14,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BackColour=&H00000000,BorderStyle=3,Outline=1.2,Shadow=0.8,MarginV=25,Alignment=2'`,
                        '-crf 23',            // Quality
                        '-preset fast'        // Speed vs compression
                    ])
                    .output(outputPath)
                    .on('start', (commandLine) => {
                        console.log('FFmpeg subtitle command:', commandLine);
                    })
                    .on('progress', (progress) => {
                        console.log(`Subtitle embedding progress: ${progress.percent ? progress.percent.toFixed(1) : 'N/A'}%`);
                    })
                    .on('end', () => {
                        console.log('Subtitle embedding completed');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Subtitle embedding error:', err);
                        reject(new Error(`Failed to embed subtitles: ${err.message}`));
                    })
                    .run();
            });
        } catch (error) {
            throw new Error(`Subtitle embedding failed: ${error.message}`);
        }

        // Step 7: Return URLs for processed files (these are temporary!)
        const serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${port}`;
        const processedVideoUrl = `${serverBaseUrl}/temp/${path.basename(outputPath)}`;
        const srtUrl = `${serverBaseUrl}/temp/${path.basename(srtPath)}`;

        console.log('Processing complete. Returning URLs:', {
            videoUrl: processedVideoUrl,
            srtUrl: srtUrl
        });

        // Schedule cleanup for these files
        // We'll keep them for 2 hours to allow download, then clean them up
        const filesToCleanup = [videoPath, audioPath, srtPath, outputPath];
        scheduleFileCleanup(filesToCleanup, 2 * 60 * 60 * 1000); // 2 hours

        res.json({
            success: true,
            videoUrl: processedVideoUrl,
            srtUrl: srtUrl,
            transcription: finalText,
            // Add these so frontend knows these are temporary links
            temporary: true,
            expiresIn: '2 hours'
        });

    } catch (error) {
        console.error('Error processing uploaded video:', error);

        // Provide clear error messages based on the type of error
        let errorMessage = 'Unknown server error';

        if (error.message.includes('transcribe')) {
            errorMessage = 'Error transcribing audio. Please try with a smaller or clearer video.';
        } else if (error.message.includes('translate')) {
            errorMessage = 'Error translating content. Please try a different language pair.';
        } else if (error.message.includes('ffmpeg')) {
            errorMessage = 'Error processing video. Please try a different format or codec.';
        } else if (error.message.includes('extract audio')) {
            errorMessage = 'Error extracting audio from video. Please try a different video file.';
        } else if (error.message.includes('embed subtitles')) {
            errorMessage = 'Error embedding subtitles. Please try a different video format.';
        } else if (error.message.includes('Connection')) {
            errorMessage = 'Connection error with AI service. Please try again in a few minutes.';
        } else if (error.message.includes('empty results')) {
            errorMessage = 'Transcription returned empty results. Please try a video with clearer audio.';
        } else {
            errorMessage = `Server error: ${error.message}`;
        }

        res.status(500).json({ error: errorMessage });

        // Clean up any files that were created
        try {
            [videoPath, audioPath, srtPath, outputPath].forEach(file => {
                if (file && fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`Cleaned up file after error: ${file}`);
                }
            });
        } catch (cleanupError) {
            console.error('Error cleaning up files after processing error:', cleanupError);
        }
    }
});

// Helper function to format time for SRT (00:00:00,000)
function formatSRTTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const milliseconds = Math.floor((seconds % 1) * 1000);

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

// Helper function to schedule cleanup of files after a delay
function scheduleFileCleanup(files, delayMs) {
    setTimeout(() => {
        files.forEach(file => {
            if (fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                    console.log(`Cleaned up temporary file: ${file}`);
                } catch (err) {
                    console.error(`Error cleaning up file ${file}:`, err);
                }
            }
        });
    }, delayMs);
}

// Schedule regular cleanup of temp directory (once every hour)
function cleanupTempDirectory() {
    console.log('Running scheduled temp directory cleanup');
    const now = Date.now();
    // Clean files older than 4 hours
    const maxAge = 4 * 60 * 60 * 1000;

    fs.readdir(tempDir, (err, files) => {
        if (err) {
            console.error('Error reading temp directory:', err);
            return;
        }

        files.forEach(file => {
            const filePath = path.join(tempDir, file);
            fs.stat(filePath, (err, stats) => {
                if (err) {
                    console.error(`Error getting stats for ${file}:`, err);
                    return;
                }

                const fileAge = now - stats.mtimeMs;
                if (fileAge > maxAge) {
                    fs.unlink(filePath, err => {
                        if (err) {
                            console.error(`Error deleting old temp file ${file}:`, err);
                        } else {
                            console.log(`Deleted old temp file: ${file}`);
                        }
                    });
                }
            });
        });
    });
}

// Run cleanup every hour
setInterval(cleanupTempDirectory, 60 * 60 * 1000);

// Initial cleanup on server start
cleanupTempDirectory();

app.listen(port, () => {
    console.log(`Video processing server running on port ${port}`);
    console.log(`Test the server by visiting http://localhost:${port}/api/test`);
});

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

