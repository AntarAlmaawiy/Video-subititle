// app/subtitle-generator/page.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import VideoDropzone from '@/components/VideoDropzone';
import LanguageSelector from '@/components/LanguageSelector';

type VideoSource = File | string | null;
type ProcessingState = 'idle' | 'uploading' | 'transcribing' | 'translating' | 'embedding' | 'completed' | 'error';

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
    const [srtUrl, setSrtUrl] = useState<string | null>(null);

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push('/signin');
        }
    }, [isLoaded, isSignedIn, router]);

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    const handleVideoSelected = (source: File | string, type: 'file' | 'link') => {
        setVideoSource(source);
        setSourceType(type);
        setErrorMessage(null);
        setProcessedVideoUrl(null);
        setSrtUrl(null);
    };

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
                                        <video src={processedVideoUrl} controls className="rounded-lg shadow-lg w-full" />
                                    </div>
                                    <div className="flex flex-wrap justify-center gap-4">
                                        <a
                                            href={processedVideoUrl}
                                            download
                                            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                        >
                                            Download Video
                                        </a>
                                        {srtUrl && (
                                            <a
                                                href={srtUrl}
                                                download
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
                                                setSrtUrl(null);
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
                                    <LanguageSelector
                                        sourceLanguage={sourceLanguage}
                                        targetLanguage={targetLanguage}
                                        onSourceLanguageChange={setSourceLanguage}
                                        onTargetLanguageChange={setTargetLanguage}
                                        disabled={processingState !== 'idle' && processingState !== 'error'}
                                    />
                                    <div className="mt-8 flex justify-center">
                                        <button
                                            onClick={() => {}}
                                            disabled={!videoSource || (processingState !== 'idle' && processingState !== 'error')}
                                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Start Processing
                                        </button>
                                    </div>
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
