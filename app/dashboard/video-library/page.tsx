// app/dashboard/video-library/page.tsx
"use client";

import React, { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { getUserVideos, deleteUserVideo, forceDownloadFile } from '@/lib/supabase';
import Link from 'next/link';
import VideoPlayer from "@/components/VideoPlayer";

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

export default function VideoLibraryPage() {
    const { data: session } = useSession();
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        const fetchVideos = async () => {
            if (!session?.user?.id) return;

            try {
                setLoading(true);
                const userVideos = await getUserVideos(session.user.id);
                setVideos(userVideos);
            } catch (err: any) {
                console.error('Error fetching videos:', err);
                setError(err.message || 'Failed to load your videos');
            } finally {
                setLoading(false);
            }
        };

        fetchVideos();
    }, [session?.user?.id]);

    const handleDeleteVideo = async (video: Video) => {
        if (!session?.user?.id) return;
        if (!confirm('Are you sure you want to delete this video?')) return;

        try {
            await deleteUserVideo(session.user.id, video.id, video.file_path);
            setVideos(videos.filter(v => v.id !== video.id));
            if (selectedVideo?.id === video.id) {
                setSelectedVideo(null);
            }
        } catch (err: any) {
            console.error('Error deleting video:', err);
            alert('Failed to delete video: ' + err.message);
        }
    };

    const handleDownloadVideo = async (video: Video) => {
        try {
            setIsDownloading(true);
            await forceDownloadFile(video.file_path, video.file_name);
        } catch (err: any) {
            console.error('Error downloading video:', err);
            alert('Failed to download video: ' + err.message);
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Your Video Library</h1>

            {loading && <p className="text-gray-500">Loading your videos...</p>}

            {error && (
                <div className="bg-red-50 p-4 rounded-md mb-4 text-red-500">
                    {error}
                </div>
            )}

            {!loading && videos.length === 0 && (
                <div className="text-center py-10">
                    <p className="text-gray-500 mb-4">You don&#39;t have any processed videos yet.</p>
                    <Link href="/subtitle-generator" className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-500">
                        Generate Subtitles
                    </Link>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left side: Video list */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-lg shadow overflow-hidden">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-medium">Your Videos</h2>
                        </div>
                        <ul className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                            {videos.map((video) => (
                                <li key={video.id} className="p-4 hover:bg-gray-50 cursor-pointer">
                                    <div
                                        className={`flex items-start space-x-3 ${selectedVideo?.id === video.id ? 'bg-indigo-50 rounded-md' : ''}`}
                                        onClick={() => setSelectedVideo(video)}
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
                                            className="text-red-500 hover:text-red-700 text-xs"
                                        >
                                            Delete
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
                                <VideoPlayer
                                    videoUrl={selectedVideo.publicUrl}
                                    height="auto"
                                    width="100%"
                                    controls={true}
                                    filePath={selectedVideo.file_path}
                                    fileName={selectedVideo.file_name}
                                />
                                <div className="mt-4 text-sm text-gray-600">
                                    <p><strong>Translated from:</strong> {selectedVideo.source_language}</p>
                                    <p><strong>Subtitles language:</strong> {selectedVideo.language}</p>
                                    <p><strong>Duration:</strong> {Math.floor(selectedVideo.duration / 60)}m {Math.floor(selectedVideo.duration % 60)}s</p>
                                    <p><strong>Created:</strong> {new Date(selectedVideo.created_at).toLocaleDateString()}</p>

                                    <div className="mt-4">
                                        <button
                                            onClick={() => handleDownloadVideo(selectedVideo)}
                                            disabled={isDownloading}
                                            className="bg-indigo-600 text-white px-3 py-1 rounded text-sm hover:bg-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                                        >
                                            {isDownloading ? 'Downloading...' : 'Download Video'}
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
        </div>
    );
}