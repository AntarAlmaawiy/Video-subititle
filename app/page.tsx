// app/page.tsx (Home page)
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Footer from '@/components/Footer';
import VideoDropzone from "@/components/VideoDropzone";
import LanguageSelector from "@/components/LanguageSelector";
import ProcessingStatus from "@/components/ProcessingStatus";

export default function Home() {
    const router = useRouter();
    const { isSignedIn } = useUser();
    const [hasUsedBefore, setHasUsedBefore] = useState(false);

    // Check localStorage on component mount
    useEffect(() => {
        const used = localStorage.getItem('hasUsedTranslator');
        if (used === 'true') {
            setHasUsedBefore(true);
        }
    }, []);

    // Handle video processing
    const handleProcessVideo = () => {
        // Check if they've used it before and aren't signed in
        if (hasUsedBefore && !isSignedIn) {
            // Redirect to sign in
            router.push('/signin');
            return;
        }

        // Process the video...
        // Your video processing logic here

        // Mark that they've used it
        localStorage.setItem('hasUsedTranslator', 'true');
        setHasUsedBefore(true);
    };

    return (
        <main>
            <Navbar />
            <div className="pt-16"> {/* Add padding for fixed navbar */}
                <Hero />

                {/* Try It Now Section */}
                <div className="py-12 bg-gray-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="text-center">
                            <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
                                Try It Now
                            </h2>
                            <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg">
                                Upload a video to translate subtitles instantly.
                            </p>
                        </div>

                        <div className="mt-10 bg-white shadow rounded-lg p-6">
                            <VideoDropzone
                                onVideoSelected={(file, type) => {
                                    // Handle file selection
                                }}
                                isProcessing={false}
                            />

                            <LanguageSelector
                                sourceLanguage="auto"
                                targetLanguage="en"
                                onSourceLanguageChange={() => {}}
                                onTargetLanguageChange={() => {}}
                            />

                            <div className="mt-6 text-center">
                                <button
                                    onClick={handleProcessVideo}
                                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                >
                                    Start Processing
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <Features />
                <Footer />

            </div>
        </main>
    );
}