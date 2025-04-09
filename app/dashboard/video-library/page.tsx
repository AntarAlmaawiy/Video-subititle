// app/dashboard/video-library/page.tsx
"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { getUserVideos, deleteUserVideo, forceDownloadFile, getUserSubscription, canUploadMoreVideos } from '@/lib/supabase';
import Link from 'next/link';
import VideoPlayer from "@/components/VideoPlayer";
import { Loader2, Plus, Crown, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Video {
    id: string;
    file_name: string;
    file_path: string;
    language: string;
    source_language: string;
    duration: number;
    created_at: string;
    publicUrl: string;
}

interface UploadLimits {
    canUpload: boolean;
    currentCount: number;
    limit: number;
    remaining: number;
    nextUploadTime?: Date;
}

export default function VideoLibraryPage() {
    const { data: session, status } = useSession();
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [currentPlan, setCurrentPlan] = useState('free');
    const [uploadLimits, setUploadLimits] = useState<UploadLimits>({
        canUpload: true,
        currentCount: 0,
        limit: 1,
        remaining: 1
    });
    const [timeRemaining, setTimeRemaining] = useState<string>('');
    const [dataFetched, setDataFetched] = useState(false);

    // Cache control - Define as a constant with useMemo to avoid recreation
    const lastFetchRef = useRef<number>(0);
    const CACHE_DURATION = useMemo(() => 5 * 60 * 1000, []); // 5 minutes
    const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Update the remaining time display and return if timer is still valid
    const updateRemainingTime = useCallback((nextTime: Date): boolean => {
        const now = new Date();
        if (now >= nextTime) {
            setTimeRemaining('');
            return false;
        }

        setTimeRemaining(formatDistanceToNow(nextTime, { addSuffix: true }));
        return true;
    }, []);

    // Fetch data with caching
    useEffect(() => {
        const fetchData = async () => {
            if (!session?.user?.id) return;

            try {
                // Check cache validity
                const now = Date.now();
                const shouldRefetch = now - lastFetchRef.current > CACHE_DURATION || !dataFetched;

                if (!shouldRefetch && dataFetched) {
                    console.log("Using cached video data");
                    setLoading(false);
                    return;
                }

                setLoading(true);
                console.log("Fetching data from API...");

                // Fetch all data in parallel
                const [userVideos, subscription, limits] = await Promise.all([
                    getUserVideos(session.user.id),
                    getUserSubscription(session.user.id),
                    canUploadMoreVideos(session.user.id)
                ]);

                console.log(`Retrieved ${userVideos.length} videos`);

                // Make sure we have valid data
                const validVideos = userVideos.filter(video =>
                    video && video.id && video.file_path && video.publicUrl
                );

                // Update state with fetched data
                setVideos(validVideos);
                setCurrentPlan(subscription.plan_id);
                setUploadLimits(limits);

                // Auto-select the first video if available
                if (validVideos.length > 0 && !selectedVideo) {
                    console.log(`Auto-selecting first video: ${validVideos[0].file_name}`);
                    setSelectedVideo(validVideos[0]);
                }

                // Set up timer for time remaining
                if (limits.nextUploadTime) {
                    updateRemainingTime(limits.nextUploadTime);
                }

                // Update cache timestamp
                lastFetchRef.current = now;
                setDataFetched(true);

            } catch (err: unknown) {
                const errorMessage = err instanceof Error ? err.message : 'Failed to load your videos';
                setError(errorMessage);
                setDataFetched(true); // Mark as fetched even on error to prevent infinite loading
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [session?.user?.id, dataFetched, updateRemainingTime, CACHE_DURATION]);

    // Set up timer interval for next upload time
    useEffect(() => {
        // Clear any existing timer
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
            timerIntervalRef.current = null;
        }

        // Set up new timer if we have a nextUploadTime
        if (uploadLimits.nextUploadTime) {
            timerIntervalRef.current = setInterval(() => {
                const stillValid = updateRemainingTime(uploadLimits.nextUploadTime!);
                if (!stillValid && timerIntervalRef.current) {
                    clearInterval(timerIntervalRef.current);
                    timerIntervalRef.current = null;
                }
            }, 60000); // Check every minute
        }

        // Cleanup
        return () => {
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
                timerIntervalRef.current = null;
            }
        };
    }, [uploadLimits.nextUploadTime, updateRemainingTime]);

    const handleDeleteVideo = useCallback(async (video: Video) => {
        if (!session?.user?.id) return;
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            setIsDeleting(true);
            await deleteUserVideo(session.user.id, video.id, video.file_path);

            // Update videos state
            setVideos(prevVideos => prevVideos.filter(v => v.id !== video.id));

            // Update selected video if needed
            if (selectedVideo?.id === video.id) {
                const remainingVideos = videos.filter(v => v.id !== video.id);
                setSelectedVideo(remainingVideos.length > 0 ? remainingVideos[0] : null);
            }

            // Refresh upload limits after deleting
            const limits = await canUploadMoreVideos(session.user.id);
            setUploadLimits(limits);
        } catch (err: unknown) {
            alert('Failed to delete video: ' + (err instanceof Error ? err.message : 'An unexpected error occurred'));
        } finally {
            setIsDeleting(false);
        }
    }, [session?.user?.id, selectedVideo, videos]);

    const handleDownloadVideo = useCallback(async (video: Video) => {
        try {
            setIsDownloading(true);
            await forceDownloadFile(video.file_path, video.file_name);
        } catch (err: unknown) {
            alert('Failed to download video: ' + (err instanceof Error ? err.message : 'An unexpected error occurred'));
        } finally {
            setIsDownloading(false);
        }
    }, []);

    // Memoize video selection handler
    const handleSelectVideo = useCallback((video: Video) => {
        setSelectedVideo(video);
    }, []);

    if (status === "loading") {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Your Video Library</h1>
                <Link
                    href="/dashboard/subtitle-generator"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500 flex items-center"
                >
                    <Plus className="h-4 w-4 mr-1" />
                    New Video
                </Link>
            </div>

            {/* Daily Limit Status */}
            {uploadLimits && dataFetched && (
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {currentPlan === 'free' ? (
                                <Clock className="h-5 w-5 text-blue-600 mr-2" />
                            ) : (
                                <Crown className="h-5 w-5 text-blue-600 mr-2" />
                            )}
                            <div>
                                <h3 className="font-medium">
                                    {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} Plan: {uploadLimits.currentCount}/{uploadLimits.limit} videos used today
                                </h3>
                                {!uploadLimits.canUpload && timeRemaining && (
                                    <p className="text-sm text-gray-600">
                                        Next video available {timeRemaining}
                                    </p>
                                )}
                            </div>
                        </div>

                        {currentPlan === 'free' && (
                            <Link
                                href="/dashboard/manage-plan"
                                className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                                Upgrade Plan
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {loading && (
                <div className="flex justify-center items-center my-12">
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                </div>
            )}

            {error && (
                <div className="bg-red-50 p-4 rounded-md mb-4 text-red-500">
                    {error}
                </div>
            )}

            {!loading && dataFetched && videos.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-gray-500 mb-4">You don&#39;t have any processed videos yet.</p>
                    <Link
                        href="/dashboard/subtitle-generator"
                        className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500"
                    >
                        Generate Subtitles
                    </Link>
                </div>
            )}

            {!loading && dataFetched && videos.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left side: Video list */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow overflow-hidden">
                            <div className="p-4 border-b border-gray-200">
                                <h2 className="font-medium">Your Videos ({videos.length})</h2>
                            </div>
                            <ul className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                                {videos.map((video) => (
                                    <li key={video.id} className="p-4 hover:bg-gray-50 cursor-pointer">
                                        <div
                                            className={`flex items-start space-x-3 ${selectedVideo?.id === video.id ? 'bg-indigo-50 rounded-md p-2' : ''}`}
                                            onClick={() => handleSelectVideo(video)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {video.file_name}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(video.created_at).toLocaleDateString()}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {video.source_language} → {video.language}
                                                </p>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteVideo(video);
                                                }}
                                                disabled={isDeleting}
                                                className={`text-red-500 hover:text-red-700 text-xs ${isDeleting ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                {isDeleting ? 'Deleting...' : 'Delete'}
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* Right side: Video player */}
                    <div className="lg:col-span-2">
                        {selectedVideo ? (
                            <div className="bg-white rounded-lg shadow overflow-hidden">
                                <div className="p-4 border-b border-gray-200">
                                    <h2 className="font-medium">{selectedVideo.file_name}</h2>
                                </div>
                                <div className="p-4">
                                    {selectedVideo.publicUrl ? (
                                        <VideoPlayer
                                            videoUrl={selectedVideo.publicUrl}
                                            height="auto"
                                            width="100%"
                                            controls={true}
                                            filePath={selectedVideo.file_path}
                                            fileName={selectedVideo.file_name}
                                        />
                                    ) : (
                                        <div className="bg-gray-100 text-center py-12 rounded">
                                            <p className="text-gray-500">Video URL not available</p>
                                        </div>
                                    )}
                                    <div className="mt-4 text-sm text-gray-600">
                                        <p><strong>Translated from:</strong> {selectedVideo.source_language}</p>
                                        <p><strong>Subtitles language:</strong> {selectedVideo.language}</p>
                                        <p><strong>Duration:</strong> {Math.floor(selectedVideo.duration / 60)}m {Math.floor(selectedVideo.duration % 60)}s</p>
                                        <p><strong>Created:</strong> {new Date(selectedVideo.created_at).toLocaleDateString()}</p>

                                        <div className="mt-4">
                                            <button
                                                onClick={() => handleDownloadVideo(selectedVideo)}
                                                disabled={isDownloading || !selectedVideo.publicUrl}
                                                className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed inline-flex items-center"
                                            >
                                                {isDownloading ? (
                                                    <>
                                                        <Loader2 className="animate-spin h-4 w-4 mr-1" />
                                                        Downloading...
                                                    </>
                                                ) : 'Download Video'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg shadow p-8 text-center h-full flex items-center justify-center">
                                <p className="text-gray-500">Select a video to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}