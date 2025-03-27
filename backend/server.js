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
import { exec } from 'child_process';

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

    // Verify FFmpeg is accessible
    exec('ffmpeg -version', (error, stdout) => {
        if (error) {
            console.error('Error verifying FFmpeg installation:', error);
            console.warn('⚠️ FFmpeg might not be properly installed or accessible');
        } else {
            console.log('FFmpeg version info:', stdout.split('\n')[0]);
        }
    });
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

// Ensure proper permissions for temp directory
try {
    fs.chmodSync(tempDir, 0o777);
    console.log(`Set permissions for temp directory: ${tempDir}`);
} catch (error) {
    console.error('Error setting temp directory permissions:', error);
}

// Configure storage for temporary files only
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, tempDir);
    },
    filename: function (req, file, cb) {
        // Sanitize original filename to remove special characters
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `${uuidv4()}-${sanitizedName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 1000 * 1024 * 1024 }, // Increase from 500MB to 1000MB
    fileFilter: (req, file, cb) => {
        // Accept video files only
        if (file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only video files are allowed'));
        }
    }
});

// Enable CORS with specific origins
const allowedOrigins = ['https://www.sub0-translate.com', 'https://sub0-translate.com'];

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, origin); // Return ONLY the matching origin
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
    optionsSuccessStatus: 204
}));

app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

// Set longer default timeouts
app.use((req, res, next) => {
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000); // 15 minutes
    next();
});

// Serve temporary files WITHOUT any additional headers
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
            apiKeyConfigured: !!process.env.OPENAI_API_KEY,
            tempDirPath: tempDir,
            tempDirExists: fs.existsSync(tempDir)
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

    // Set longer timeouts
    req.setTimeout(900000); // 15 minutes
    res.setTimeout(900000); // 15 minutes

    try {
        console.log('Received request to process uploaded video');
        const videoFile = req.file;
        const { sourceLanguage = 'auto', targetLanguage = 'en' } = req.body;

        if (!videoFile) {
            return res.status(400).json({ error: 'No video file provided' });
        }

        // Validate the file
        if (!videoFile.mimetype.startsWith('video/')) {
            return res.status(400).json({ error: 'The uploaded file is not a valid video format' });
        }

        // Verify file isn't empty
        if (videoFile.size === 0) {
            return res.status(400).json({ error: 'The uploaded video file is empty' });
        }

        console.log('Processing file:', videoFile.originalname, 'Size:', (videoFile.size / (1024 * 1024)).toFixed(2), 'MB');

        const videoId = path.basename(videoFile.path, path.extname(videoFile.path));
        videoPath = videoFile.path;
        audioPath = path.join(tempDir, `${videoId}.mp3`);
        srtPath = path.join(tempDir, `${videoId}.srt`);
        outputPath = path.join(tempDir, `${videoId}-with-subtitles.mp4`);

        // Step 2: Extract audio from the video
        console.log('Extracting audio...');
        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .audioChannels(1)
                .audioFrequency(16000)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .toFormat('mp3')
                .on('start', commandLine => {
                    console.log('FFmpeg started audio extraction with command:', commandLine);
                })
                .on('progress', progress => {
                    console.log(`Audio extraction progress: ${progress.percent ? progress.percent.toFixed(1) : 0}%`);
                })
                .on('end', () => {
                    console.log('Audio extraction completed');
                    resolve();
                })
                .on('error', err => {
                    console.error('Error extracting audio:', err);
                    reject(err);
                })
                .run();
        });

        // Check if audio file was created successfully
        if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
            throw new Error('Failed to extract audio from video');
        }

        // Step 3: Transcribe the audio
        console.log('Transcribing audio...');
        const audioFile = fs.createReadStream(audioPath);
        const transcriptionResponse = await openai.audio.transcriptions.create({
            file: audioFile,
            model: 'whisper-1',
            language: sourceLanguage !== 'auto' ? sourceLanguage : undefined,
            response_format: 'verbose_json',
            timestamp_granularities: ["segment"]
        });

        // Step 4: Translation if needed
        console.log('Processing transcription...');
        let finalText = transcriptionResponse.text;
        let translatedSegments = transcriptionResponse.segments || [];

        if (sourceLanguage !== targetLanguage && targetLanguage !== 'auto') {
            console.log(`Translating from ${sourceLanguage} to ${targetLanguage}...`);

            if (translatedSegments.length > 0) {
                // Translate each segment
                const newSegments = [];
                for (const segment of translatedSegments) {
                    const translationResponse = await openai.chat.completions.create({
                        model: 'gpt-3.5-turbo',
                        messages: [
                            { role: 'system', content: `Translate from ${sourceLanguage} to ${targetLanguage}.` },
                            { role: 'user', content: segment.text }
                        ]
                    });

                    newSegments.push({
                        ...segment,
                        text: translationResponse.choices[0]?.message?.content || segment.text
                    });
                }
                translatedSegments = newSegments;
            }

            // Also translate the full text
            const fullTranslation = await openai.chat.completions.create({
                model: 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: `Translate from ${sourceLanguage} to ${targetLanguage}.` },
                    { role: 'user', content: finalText }
                ]
            });

            finalText = fullTranslation.choices[0]?.message?.content || finalText;
        }

        // Step 5: Create SRT file
        console.log('Creating SRT file...');
        let srtContent = '';
        translatedSegments.forEach((segment, index) => {
            const startTime = formatSRTTime(segment.start);
            const endTime = formatSRTTime(segment.end);
            srtContent += `${index + 1}\n${startTime} --> ${endTime}\n${segment.text.trim()}\n\n`;
        });
        fs.writeFileSync(srtPath, srtContent);

        // Verify SRT file was created successfully
        if (!fs.existsSync(srtPath) || fs.statSync(srtPath).size === 0) {
            throw new Error('Failed to create subtitle file');
        }

        // Step 6: Embed subtitles with better error reporting
        console.log('Embedding subtitles...');
        try {
            // Platform-specific path handling
            const escapedSrtPath = process.platform === 'win32'
                ? srtPath.replace(/\\/g, '\\\\')
                : srtPath.replace(/[\:]/g, '\\:');

            console.log(`Using subtitle path: ${escapedSrtPath}`);

            await new Promise((resolve, reject) => {
                ffmpeg(videoPath)
                    .outputOptions([
                        '-c:v libx264',
                        '-c:a aac',
                        `-vf`, `subtitles=${escapedSrtPath}:force_style='FontName=Arial,FontSize=14,PrimaryColour=&HFFFFFF,OutlineColour=&H000000,BackColour=&H00000000,BorderStyle=3,Outline=1.2,Shadow=0.8,MarginV=25,Alignment=2'`,
                        '-crf 23',
                        '-preset fast'
                    ])
                    .output(outputPath)
                    .on('start', (commandLine) => {
                        console.log('FFmpeg spawned with command:', commandLine);
                    })
                    .on('progress', (progress) => {
                        console.log(`FFmpeg progress: ${progress.percent ? progress.percent.toFixed(1) : 0}% done`);
                    })
                    .on('end', () => {
                        console.log('FFmpeg processing finished successfully');
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('FFmpeg error:', err);
                        reject(new Error(`FFmpeg processing failed: ${err.message}`));
                    })
                    .run();
            });
        } catch (error) {
            console.error('Error during FFmpeg processing:', error);
            throw error;
        }

        // Verify output video file was created successfully
        if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size === 0) {
            throw new Error('Failed to embed subtitles in video');
        }

        // Step 7: Return URLs
        const serverBaseUrl = process.env.SERVER_BASE_URL || `https://api.sub0-translate.com`;
        const processedVideoUrl = `${serverBaseUrl}/temp/${path.basename(outputPath)}`;
        const srtUrl = `${serverBaseUrl}/temp/${path.basename(srtPath)}`;

        console.log('Processing complete. Returning URLs:', {
            videoUrl: processedVideoUrl,
            srtUrl: srtUrl
        });

        // Schedule cleanup
        const filesToCleanup = [videoPath, audioPath, srtPath, outputPath];
        scheduleFileCleanup(filesToCleanup, 4 * 60 * 60 * 1000);

        // Return a standard JSON response
        res.json({
            success: true,
            videoUrl: processedVideoUrl,
            srtUrl: srtUrl,
            transcription: finalText,
            temporary: true,
            expiresIn: '4 hours'
        });
    } catch (error) {
        console.error('Error processing video:', error);

        let errorMessage = 'Error processing video.';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        res.status(500).json({
            error: errorMessage,
            timestamp: new Date().toISOString()
        });

        // Clean up files
        [videoPath, audioPath, srtPath, outputPath].forEach(file => {
            if (file && fs.existsSync(file)) {
                try {
                    fs.unlinkSync(file);
                    console.log(`Cleaned up file after error: ${file}`);
                } catch (e) {
                    console.error(`Error cleaning up file ${file}:`, e);
                }
            }
        });
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