'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward, Loader, Download } from 'lucide-react';
import { forceDownloadFile } from '@/lib/supabase';

interface VideoPlayerProps {
    videoUrl: string;
    width?: string | number;
    height?: string | number;
    controls?: boolean;
    posterUrl?: string;
    fileName?: string;
    filePath?: string; // Added for download functionality
}

const VideoPlayer = ({
                         videoUrl,
                         width = '100%',
                         height = 'auto',
                         controls = true,
                         posterUrl,
                         fileName,
                         filePath
                     }: VideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loadingProgress, setLoadingProgress] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);

    useEffect(() => {
        if (!videoUrl) return;

        // Preload optimization
        if (posterUrl) {
            const img = new Image();
            img.src = posterUrl;
        }

        const video = videoRef.current;
        if (video) {
            video.preload = 'metadata';

            // Reset state when URL changes
            setIsLoading(true);
            setError(null);
            setIsPlaying(false);
            setCurrentTime(0);
            setLoadingProgress(0);

            // Stop any existing playback
            try {
                video.pause();
                video.currentTime = 0;
                video.load();
            } catch (e) {
                console.error('Error resetting video:', e);
            }
        }
    }, [videoUrl, posterUrl]);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
            // Still loading but metadata is available
            setLoadingProgress(25);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        const handlePlay = () => {
            setIsPlaying(true);
        };

        const handlePause = () => {
            setIsPlaying(false);
        };

        const handleError = (e: Event) => {
            console.error('Video error:', e, video.error);
            setError(video.error?.message || 'Failed to load video');
            setIsLoading(false);
        };

        const handleCanPlay = () => {
            setIsLoading(false);
            setLoadingProgress(100);
        };

        const handleProgress = () => {
            // Track buffering progress
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const progress = Math.round((bufferedEnd / video.duration) * 75); // Max 75% for buffering
                setLoadingProgress(25 + progress); // Start at 25% after metadata loads
            }
        };

        const handleWaiting = () => {
            setIsLoading(true);
        };

        // Add event listeners
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);
        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('error', handleError);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('progress', handleProgress);
        video.addEventListener('waiting', handleWaiting);

        return () => {
            // Clean up event listeners
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('error', handleError);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('progress', handleProgress);
            video.removeEventListener('waiting', handleWaiting);
        };
    }, [videoUrl]);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(document.fullscreenElement !== null);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, []);

    const togglePlay = () => {
        const video = videoRef.current;
        if (!video) return;

        try {
            if (isPlaying) {
                video.pause();
            } else {
                // Wrap in a try/catch for browsers that might throw on play()
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.error('Error playing video:', error);
                        setIsPlaying(false);
                    });
                }
            }
        } catch (error) {
            console.error('Error toggling play/pause:', error);
            setIsPlaying(false);
        }
    };

    const toggleMute = () => {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setIsMuted(video.muted);
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;

        const newVolume = parseFloat(e.target.value);
        video.volume = newVolume;
        setVolume(newVolume);
        setIsMuted(newVolume === 0);
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const video = videoRef.current;
        if (!video) return;

        const newTime = parseFloat(e.target.value);
        video.currentTime = newTime;
        setCurrentTime(newTime);
    };

    const toggleFullscreen = () => {
        const player = playerRef.current;
        if (!player) return;

        try {
            if (!document.fullscreenElement) {
                player.requestFullscreen().catch((err) => {
                    console.error(`Error attempting to enable fullscreen: ${err.message}`);
                });
            } else {
                document.exitFullscreen();
            }
        } catch (error) {
            console.error('Error toggling fullscreen:', error);
        }
    };

    const formatTime = (timeInSeconds: number) => {
        const minutes = Math.floor(timeInSeconds / 60);
        const seconds = Math.floor(timeInSeconds % 60);
        return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
    };

    const jumpTime = (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;

        const newTime = Math.max(0, Math.min(video.duration, video.currentTime + seconds));
        video.currentTime = newTime;
    };

    const handleDownload = async () => {
        if (!filePath || !fileName) return;

        try {
            setIsDownloading(true);
            await forceDownloadFile(filePath, fileName);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download video. Please try again.');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div
            ref={playerRef}
            className="w-full mx-auto max-w-3xl bg-black rounded-lg overflow-hidden"
            style={{ width, height: typeof height === 'string' ? height : `${height}px` }}
        >
            <div className="relative h-full">
                {isLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 z-10">
                        <Loader className="h-10 w-10 text-white animate-spin mb-3" />
                        {loadingProgress > 0 && (
                            <div className="w-1/2 bg-gray-200 rounded-full h-1.5 mt-2">
                                <div
                                    className="bg-blue-600 h-1.5 rounded-full"
                                    style={{ width: `${loadingProgress}%` }}
                                ></div>
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                        <div className="text-white text-center p-4">
                            <p className="text-red-500 mb-2">Error loading video</p>
                            <p className="text-sm">{error}</p>
                            <button
                                onClick={() => {
                                    const video = videoRef.current;
                                    if (video) {
                                        setError(null);
                                        setIsLoading(true);
                                        video.load(); // Try to reload the video
                                    }
                                }}
                                className="mt-3 bg-blue-600 text-white px-3 py-1 rounded text-sm"
                            >
                                Retry
                            </button>
                        </div>
                    </div>
                )}

                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    onClick={togglePlay}
                    preload="metadata"
                    playsInline
                    poster={posterUrl}
                    controls={false}
                />

                {/* Play/Pause overlay button (center of video) */}
                {!isPlaying && !isLoading && !error && (
                    <button
                        onClick={togglePlay}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/40 rounded-full p-4 text-white z-10"
                    >
                        <Play className="h-8 w-8" />
                    </button>
                )}

                {/* Controls */}
                {controls && !error && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
                        {/* Progress bar */}
                        <div className="flex items-center gap-2 mb-1 text-xs text-white">
                            <span>{formatTime(currentTime)}</span>
                            <input
                                type="range"
                                min="0"
                                max={duration || 100}
                                value={currentTime}
                                onChange={handleSeek}
                                className="w-full h-1 bg-gray-500 rounded-full appearance-none cursor-pointer"
                            />
                            <span>{formatTime(duration)}</span>
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <button onClick={togglePlay} className="text-white">
                                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                                </button>

                                <button onClick={() => jumpTime(-10)} className="text-white">
                                    <SkipBack className="h-5 w-5" />
                                </button>

                                <button onClick={() => jumpTime(10)} className="text-white">
                                    <SkipForward className="h-5 w-5" />
                                </button>

                                <div className="flex items-center gap-2">
                                    <button onClick={toggleMute} className="text-white">
                                        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                                    </button>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.1"
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="w-16 h-1 bg-gray-500 rounded-full appearance-none cursor-pointer"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                {filePath && fileName && (
                                    <button
                                        onClick={handleDownload}
                                        disabled={isDownloading}
                                        className="text-white"
                                    >
                                        <Download className="h-5 w-5" />
                                    </button>
                                )}

                                <button onClick={toggleFullscreen} className="text-white">
                                    <Maximize className="h-5 w-5" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPlayer;