'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, SkipBack, SkipForward } from 'lucide-react';

interface VideoPlayerProps {
    videoUrl: string;
}

const VideoPlayer = ({ videoUrl }: VideoPlayerProps) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const playerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
        };

        const handleEnded = () => {
            setIsPlaying(false);
        };

        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('ended', handleEnded);

        return () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('ended', handleEnded);
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

        if (isPlaying) {
            video.pause();
        } else {
            video.play();
        }

        setIsPlaying(!isPlaying);
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

        if (!document.fullscreenElement) {
            player.requestFullscreen().catch((err) => {
                console.error(`Error attempting to enable fullscreen: ${err.message}`);
            });
        } else {
            document.exitFullscreen();
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

    return (
        <div ref={playerRef} className="w-full mx-auto max-w-3xl bg-black rounded-lg overflow-hidden">
            <div className="relative">
                <video
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full aspect-video"
                    onClick={togglePlay}
                />

                {/* Play/Pause overlay button (center of video) */}
                {!isPlaying && (
                    <button
                        onClick={togglePlay}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/40 rounded-full p-4 text-white"
                    >
                        <Play className="h-8 w-8" />
                    </button>
                )}

                {/* Controls */}
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

                        <button onClick={toggleFullscreen} className="text-white">
                            <Maximize className="h-5 w-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VideoPlayer;