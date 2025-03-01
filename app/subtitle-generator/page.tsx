// app/subtitle-generator/page.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VideoDropzone from '@/components/VideoDropzone';
import LanguageSelector from '@/components/LanguageSelector';
import VideoPlayer from '@/components/VideoPlayer';
import { Loader2 } from 'lucide-react';

type VideoSource = File | string | null;
type ProcessingState = 'idle' | 'uploading' | 'processing' | 'downloading' | 'completed' | 'error';

// Replace with your standalone API service URL
const VIDEO_PROCESSING_API = 'http://localhost:3001';

export default function SubtitleGenerator() {
    const { isLoaded, isSignedIn } = useUser();
    const router = useRouter();

    // State for video processing
    const [videoSource, setVideoSource] = useState<VideoSource>(null);
    const [sourceType, setSourceType] = useState<'file' | 'link' | null>(null);
    const [sourceLanguage, setSourceLanguage] = useState('auto');
    const [targetLanguage, setTargetLanguage] = useState('en');
    const [processingState, setProcessingState] = useState<ProcessingState>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null);
    const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null);
    const [srtUrl, setSrtUrl] = useState<string | null>(null);
    const [transcription, setTranscription] = useState<string | null>(null);
    const [processingProgress, setProcessingProgress] = useState(0);

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push('/signin');
        }
    }, [isLoaded, isSignedIn, router]);

    // Create an object URL for File type video sources
    useEffect(() => {
        if (videoSource instanceof File && sourceType === 'file') {
            const url = URL.createObjectURL(videoSource);
            setOriginalVideoUrl(url);

            // Clean up object URL when component unmounts or when source changes
            return () => {
                URL.revokeObjectURL(url);
            };
        } else if (typeof videoSource === 'string' && sourceType === 'link') {
            setOriginalVideoUrl(videoSource);
        }
    }, [videoSource, sourceType]);

    const handleVideoSelected = (source: File | string, type: 'file' | 'link') => {
        setVideoSource(source);
        setSourceType(type);
        setErrorMessage(null);
        setProcessedVideoUrl(null);
        setSrtUrl(null);
        setTranscription(null);
        setProcessingState('idle');
        setProcessingProgress(0);
    };

    const processVideo = async () => {
        if (!videoSource) return;

        try {
            setProcessingState('uploading');
            setProcessingProgress(10);

            let response;

            if (sourceType === 'file') {
                // For file uploads
                const formData = new FormData();
                formData.append('video', videoSource as File);
                formData.append('sourceLanguage', sourceLanguage);
                formData.append('targetLanguage', targetLanguage);

                setProcessingProgress(20);
                setProcessingState('processing');

                response = await fetch(`${VIDEO_PROCESSING_API}/api/process-video`, {
                    method: 'POST',
                    body: formData,
                });

            } else if (sourceType === 'link' && typeof videoSource === 'string') {
                // For video links
                setProcessingProgress(20);
                setProcessingState('processing');

                response = await fetch(`${VIDEO_PROCESSING_API}/api/process-youtube`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        videoUrl: videoSource,
                        sourceLanguage,
                        targetLanguage,
                    }),
                });
            } else {
                throw new Error('Invalid video source');
            }

            if (!response.ok) {
                const responseText = await response.text();
                console.error("API error response:", responseText);
                throw new Error(`API Error (${response.status}): ${responseText.substring(0, 100)}...`);
            }

            setProcessingProgress(80);
            setProcessingState('downloading');

            const data = await response.json();

            // Update state with processed data
            setProcessedVideoUrl(data.videoUrl);
            setSrtUrl(data.srtUrl);
            setTranscription(data.transcription);

            setProcessingProgress(100);
            setProcessingState('completed');

        } // In app/subtitle-generator/page.tsx, add to the catch block in processVideo:

        catch (error: any) {
            console.error('Processing error:', error);
            if (error.message && error.message.includes('YouTube')) {
                setErrorMessage("YouTube video processing is currently unavailable. Please download the video manually and upload it as a file instead.");
            } else {
                setErrorMessage(error.message || "An unknown error occurred");
            }
            setProcessingState('error');
        }
    };

    // Function to simulate progress for demo purposes
    // Remove this in the real implementation
    useEffect(() => {
        if (processingState === 'processing' && processingProgress < 75) {
            const interval = setInterval(() => {
                setProcessingProgress(prev => Math.min(prev + 1, 75));
            }, 500);

            return () => clearInterval(interval);
        }
    }, [processingState, processingProgress]);

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <main>
            <Navbar />
            <div className="pt-20 pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                            Video Subtitle Translator
                        </h1>
                        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg">
                            Upload a video or provide a link, and we&#39;ll automatically translate and embed subtitles.
                        </p>
                    </div>

                    <div className="mt-12 bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            {processingState === 'completed' && processedVideoUrl ? (
                                <div className="space-y-6">
                                    <div className="text-center">
                                        <h2 className="text-lg leading-6 font-medium text-gray-900">Processing Complete!</h2>
                                        <p className="mt-1 text-sm text-gray-500">
                                            Your video has been processed with {targetLanguage} subtitles.
                                        </p>
                                    </div>
                                    <div className="aspect-w-16 aspect-h-9">
                                        <VideoPlayer videoUrl={processedVideoUrl} />
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        <a
                                            href={processedVideoUrl}
                                            download="video-with-subtitles.mp4"
                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                        >
                                            Download Video
                                        </a>

                                        {srtUrl && (
                                            <a
                                                href={srtUrl}
                                                download="subtitles.srt"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none"
                                            >
                                                Download Subtitles
                                            </a>
                                        )}

                                        <button
                                            onClick={() => {
                                                setVideoSource(null);
                                                setSourceType(null);
                                                setProcessingState('idle');
                                                setProcessedVideoUrl(null);
                                                setOriginalVideoUrl(null);
                                                setSrtUrl(null);
                                                setTranscription(null);
                                                setProcessingProgress(0);
                                            }}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                        >
                                            Process Another Video
                                        </button>
                                    </div>

                                </div>
                                ) : (
                                <>
                                <VideoDropzone
                                onVideoSelected={handleVideoSelected}
                             isProcessing={processingState !== 'idle' && processingState !== 'error'}
                        />

                        {/* Show original video preview if available */}
                        {originalVideoUrl && processingState === 'idle' && (
                            <div className="mt-6">
                                <h3 className="text-lg font-medium text-gray-900 mb-3">Video Preview</h3>
                                <VideoPlayer videoUrl={originalVideoUrl} />
                            </div>
                        )}

                        <LanguageSelector
                            sourceLanguage={sourceLanguage}
                            targetLanguage={targetLanguage}
                            onSourceLanguageChange={setSourceLanguage}
                            onTargetLanguageChange={setTargetLanguage}
                            disabled={processingState !== 'idle' && processingState !== 'error'}
                        />

                        <div className="mt-8 flex justify-center">
                            <button
                                onClick={processVideo}
                                disabled={!videoSource || (processingState !== 'idle' && processingState !== 'error')}
                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {processingState !== 'idle' && processingState !== 'error' ? (
                                    <span className="flex items-center">
                                                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                        {processingState === 'uploading' && 'Uploading...'}
                                        {processingState === 'processing' && 'Processing...'}
                                        {processingState === 'downloading' && 'Finalizing...'}
                                                </span>
                                ) : (
                                    'Start Processing'
                                )}
                            </button>
                        </div>

                        {/* Progress bar */}
                        {processingState !== 'idle' && processingState !== 'error' && processingState !== 'completed' && (
                            <div className="mt-6">
                                <div className="relative pt-1">
                                    <div className="flex mb-2 items-center justify-between">
                                        <div>
                                                        <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                                                            {processingState === 'uploading' ? 'Uploading' :
                                                                processingState === 'processing' ? 'Processing' : 'Finalizing'}
                                                        </span>
                                        </div>
                                        <div className="text-right">
                                                        <span className="text-xs font-semibold inline-block text-indigo-600">
                                                            {processingProgress}%
                                                        </span>
                                        </div>
                                    </div>
                                    <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                                        <div
                                            style={{ width: `${processingProgress}%` }}
                                            className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-500 transition-all duration-500"
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Show processing video if available */}
                        {originalVideoUrl && processingState !== 'idle' && processingState !== 'error' && processingState !== 'completed' && (
                            <div className="mt-8">
                                <div className="text-center mb-4">
                                    <h3 className="text-lg font-medium text-gray-900">Processing Your Video</h3>
                                    <p className="text-sm text-gray-500">
                                        Please wait while we process your video. This may take a few minutes.
                                    </p>
                                </div>
                                <VideoPlayer videoUrl={originalVideoUrl} />
                            </div>
                        )}

                        {errorMessage && (
                            <div className="mt-4 text-center text-red-600">
                                {errorMessage}
                            </div>
                        )}
                    </>
                    )}
                </div>
            </div>
        </div>
</div>
    <Footer />
</main>
);
}