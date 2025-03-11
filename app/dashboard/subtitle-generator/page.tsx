// app/subtitle-generator/page.tsx
"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import VideoDropzone from "@/components/VideoDropzone"
import LanguageSelector from "@/components/LanguageSelector"
import VideoPlayer from "@/components/VideoPlayer"
import { Loader2, Clock, AlertCircle } from "lucide-react"
import { canUploadMoreVideos, getUserSubscription, uploadProcessedVideo } from "@/lib/supabase"
import Link from "next/link"
import { formatDistanceToNow } from 'date-fns'

type VideoSource = File | string | null
type ProcessingState = "idle" | "uploading" | "processing" | "downloading" | "completed" | "error"

// Replace with your standalone API service URL
const VIDEO_PROCESSING_API = "http://localhost:3001"

export default function SubtitleGenerator() {
    const { data: session, status } = useSession()
    const isLoaded = status !== "loading"
    const isSignedIn = status === "authenticated"
    const router = useRouter()

    // State for video processing
    const [videoSource, setVideoSource] = useState<VideoSource>(null)
    const [sourceType, setSourceType] = useState<"file" | "link" | null>(null)
    const [sourceLanguage, setSourceLanguage] = useState("auto")
    const [targetLanguage, setTargetLanguage] = useState("en")
    const [processingState, setProcessingState] = useState<ProcessingState>("idle")
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [processedVideoUrl, setProcessedVideoUrl] = useState<string | null>(null)
    const [originalVideoUrl, setOriginalVideoUrl] = useState<string | null>(null)
    const [srtUrl, setSrtUrl] = useState<string | null>(null)
    const [transcription, setTranscription] = useState<string | null>(null)
    const [processingProgress, setProcessingProgress] = useState(0)
    const [videoDuration, setVideoDuration] = useState(0)
    const [savedToLibrary, setSavedToLibrary] = useState(false)
    const [saving, setSaving] = useState(false)

    // New state for plan limits
    const [uploadLimits, setUploadLimits] = useState<{
        canUpload: boolean;
        currentCount: number;
        limit: number;
        remaining: number;
        nextUploadTime?: Date;
    }>({
        canUpload: true,
        currentCount: 0,
        limit: 1,
        remaining: 1
    })
    const [subscription, setSubscription] = useState<{
        plan_id: string;
        status: string;
    }>({
        plan_id: 'free',
        status: 'active'
    })
    const [timeRemaining, setTimeRemaining] = useState<string>('')
    const [isTimerActive, setIsTimerActive] = useState(false)

    useEffect(() => {
        if (isLoaded && !isSignedIn) {
            router.push("/signin?callbackUrl=/subtitle-generator")
        } else if (isSignedIn && session?.user?.id) {
            loadUserPlanLimits()
        }
    }, [isLoaded, isSignedIn, router, session?.user?.id])

    // Load user's plan limits and check if they can upload more videos
    const loadUserPlanLimits = async () => {
        if (!session?.user?.id) return

        try {
            // These functions now handle errors internally and return defaults if needed

            // Get user's subscription - won't throw errors
            const userSubscription = await getUserSubscription(session.user.id)
            setSubscription({
                plan_id: userSubscription.plan_id || 'free',
                status: userSubscription.status || 'active'
            })

            // Check if user can upload more videos - won't throw errors
            const limits = await canUploadMoreVideos(session.user.id)
            setUploadLimits(limits)

            // Check if we need to activate a timer for the next available upload
            if (!limits.canUpload && limits.nextUploadTime) {
                setIsTimerActive(true)
                updateRemainingTime(limits.nextUploadTime)

                // Set up interval to update the timer
                const timerInterval = setInterval(() => {
                    if (limits.nextUploadTime) {
                        const stillValid = updateRemainingTime(limits.nextUploadTime)
                        if (!stillValid) {
                            clearInterval(timerInterval)
                            loadUserPlanLimits() // Reload limits after timer expires
                        }
                    } else {
                        clearInterval(timerInterval)
                    }
                }, 60000) // Update every minute

                return () => clearInterval(timerInterval)
            }
        } catch (error) {
            console.error("Error loading user plan limits:", error)
            const errorMessage = error instanceof Error ? error.message : "Failed to load your plan limits"
            setErrorMessage(errorMessage)

            // Set default values
            setSubscription({
                plan_id: 'free',
                status: 'active'
            })

            setUploadLimits({
                canUpload: true,
                currentCount: 0,
                limit: 1,
                remaining: 1
            })
        }
    }

    // Update the remaining time display and return if timer is still valid
    const updateRemainingTime = (nextTime: Date): boolean => {
        const now = new Date()
        if (now >= nextTime) {
            setIsTimerActive(false)
            setTimeRemaining('')
            return false
        }

        setTimeRemaining(formatDistanceToNow(nextTime, { addSuffix: true }))
        return true
    }

    // Create an object URL for File type video sources
    useEffect(() => {
        if (videoSource instanceof File && sourceType === "file") {
            const url = URL.createObjectURL(videoSource)
            setOriginalVideoUrl(url)

            // Get video duration
            const video = document.createElement("video")
            video.preload = "metadata"
            video.onloadedmetadata = () => {
                setVideoDuration(video.duration)
            }
            video.src = url

            // Clean up object URL when component unmounts or when source changes
            return () => {
                URL.revokeObjectURL(url)
            }
        } else if (typeof videoSource === "string" && sourceType === "link") {
            setOriginalVideoUrl(videoSource)
        }
    }, [videoSource, sourceType])

    const handleVideoSelected = (source: File | string, type: "file" | "link") => {
        setVideoSource(source)
        setSourceType(type)
        setErrorMessage(null)
        setProcessedVideoUrl(null)
        setSrtUrl(null)
        setTranscription(null)
        setProcessingState("idle")
        setProcessingProgress(0)
        setSavedToLibrary(false)
    }

    const processVideo = async () => {
        if (!videoSource || !session?.user?.id) return

        // Check if user can upload more videos
        const limits = await canUploadMoreVideos(session.user.id)
        if (!limits.canUpload) {
            setErrorMessage(`You've reached your daily video limit (${limits.limit} per day). ${timeRemaining ? `Next upload available ${timeRemaining}.` : 'Please upgrade your plan for more videos per day.'}`)
            return
        }

        try {
            setProcessingState("uploading")
            setProcessingProgress(10)

            let response

            if (sourceType === "file") {
                // For file uploads
                const formData = new FormData()
                formData.append("video", videoSource as File)
                formData.append("sourceLanguage", sourceLanguage)
                formData.append("targetLanguage", targetLanguage)

                setProcessingProgress(20)
                setProcessingState("processing")

                response = await fetch(`${VIDEO_PROCESSING_API}/api/process-video`, {
                    method: "POST",
                    body: formData,
                })
            } else if (sourceType === "link" && typeof videoSource === "string") {
                // For video links
                setProcessingProgress(20)
                setProcessingState("processing")

                response = await fetch(`${VIDEO_PROCESSING_API}/api/process-youtube`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        videoUrl: videoSource,
                        sourceLanguage,
                        targetLanguage,
                    }),
                })
            } else {
                throw new Error("Invalid video source")
            }

            if (!response.ok) {
                const responseText = await response.text()
                console.error("API error response:", responseText)
                throw new Error(`API Error (${response.status}): ${responseText.substring(0, 100)}...`)
            }

            setProcessingProgress(80)
            setProcessingState("downloading")

            const data = await response.json()

            // Update state with processed data
            setProcessedVideoUrl(data.videoUrl)
            setSrtUrl(data.srtUrl)
            setTranscription(data.transcription)

            setProcessingProgress(100)
            setProcessingState("completed")

            // Reload limits after processing is complete
            loadUserPlanLimits()
        } catch (error: any) {
            console.error("Processing error:", error)
            if (error.message && error.message.includes("YouTube")) {
                setErrorMessage(
                    "YouTube video processing is currently unavailable. Please download the video manually and upload it as a file instead.",
                )
            } else {
                setErrorMessage(error.message || "An unknown error occurred")
            }
            setProcessingState("error")
        }
    }

    // Function to save the processed video to Supabase
    const saveVideoToLibrary = async () => {
        if (!processedVideoUrl || !session?.user?.id) return

        try {
            // Show loading state
            setErrorMessage(null)
            setSaving(true)

            console.log("Downloading video from:", processedVideoUrl)

            // First, fetch the video file from the URL with proper CORS handling
            const response = await fetch(processedVideoUrl, {
                method: "GET",
                mode: "cors",
                cache: "no-cache",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "video/mp4",
                },
            })

            if (!response.ok) {
                throw new Error(`Failed to download the processed video: ${response.status} ${response.statusText}`)
            }

            const videoBlob = await response.blob()
            console.log("Video blob size:", videoBlob.size)

            if (videoBlob.size === 0) {
                throw new Error("Downloaded video is empty")
            }

            // Extract filename from URL or generate one
            const urlParts = processedVideoUrl.split("/")
            let fileName = urlParts[urlParts.length - 1]

            // If filename has query parameters, remove them
            if (fileName.includes("?")) {
                fileName = fileName.split("?")[0]
            }

            // If no filename could be extracted, create a generic one
            if (!fileName || fileName === "") {
                fileName = `video_${Date.now()}.mp4`
            }

            console.log("Saving video with filename:", fileName)

            // Create a File object from the Blob (better for upload)
            const videoFile = new File([videoBlob], fileName, { type: "video/mp4" })

            // Upload to Supabase
            const result = await uploadProcessedVideo(videoFile, session.user.id, fileName, {
                language: targetLanguage,
                sourceLanguage: sourceLanguage === "auto" ? "auto-detected" : sourceLanguage,
                duration: videoDuration || 0,
            })

            console.log("Upload successful:", result)
            setSavedToLibrary(true)

            // Reload limits after saving to library
            loadUserPlanLimits()
        } catch (error: any) {
            console.error("Error saving to library:", error)
            setErrorMessage(`Failed to save to your library: ${error.message}`)
        } finally {
            setSaving(false)
        }
    }

    // Function to simulate progress for demo purposes
    // Remove this in the real implementation
    useEffect(() => {
        if (processingState === "processing" && processingProgress < 75) {
            const interval = setInterval(() => {
                setProcessingProgress((prev) => Math.min(prev + 1, 75))
            }, 500)

            return () => clearInterval(interval)
        }
    }, [processingState, processingProgress])

    if (!isLoaded || !isSignedIn) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        )
    }

    return (
        <main>
            <div className="pt-20 pb-16">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">Video Subtitle Translator</h1>
                        <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg">
                            Upload a video or provide a link, and we&#39;ll automatically translate and embed subtitles.
                        </p>
                    </div>

                    {/* Plan Limit Banner */}
                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center">
                                <div className="mr-3 bg-blue-100 rounded-full p-2">
                                    <Clock className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-blue-800">
                                        {subscription.plan_id.charAt(0).toUpperCase() + subscription.plan_id.slice(1)} Plan
                                    </h3>
                                    <p className="text-sm text-blue-600">
                                        {uploadLimits.currentCount}/{uploadLimits.limit} videos used today
                                        {isTimerActive && timeRemaining &&
                                            ` • Next video available ${timeRemaining}`
                                        }
                                    </p>
                                </div>
                            </div>
                            {(uploadLimits.remaining === 0 || !uploadLimits.canUpload) && subscription.plan_id === 'free' && (
                                <Link
                                    href="/dashboard/manage-plan"
                                    className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md"
                                >
                                    Upgrade Plan
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="mt-8 bg-white shadow overflow-hidden sm:rounded-lg">
                        <div className="px-4 py-5 sm:p-6">
                            {processingState === "completed" && processedVideoUrl ? (
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

                                        {/* Save to Library Button */}
                                        <button
                                            onClick={saveVideoToLibrary}
                                            disabled={savedToLibrary || saving}
                                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${
                                                savedToLibrary
                                                    ? "bg-gray-400 cursor-not-allowed"
                                                    : saving
                                                        ? "bg-purple-400 cursor-wait"
                                                        : "bg-purple-600 hover:bg-purple-700 focus:outline-none"
                                            }`}
                                        >
                                            {savedToLibrary ? (
                                                "Saved to Library"
                                            ) : saving ? (
                                                <span className="flex items-center">
                                                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                                  Saving...
                                                </span>
                                            ) : (
                                                "Save to My Library"
                                            )}
                                        </button>

                                        <button
                                            onClick={() => {
                                                setVideoSource(null)
                                                setSourceType(null)
                                                setProcessingState("idle")
                                                setProcessedVideoUrl(null)
                                                setOriginalVideoUrl(null)
                                                setSrtUrl(null)
                                                setTranscription(null)
                                                setProcessingProgress(0)
                                                setSavedToLibrary(false)
                                            }}
                                            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                                        >
                                            Process Another Video
                                        </button>

                                        {savedToLibrary && (
                                            <Link
                                                href="/dashboard/video-library"
                                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                                            >
                                                View in Library
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {!uploadLimits.canUpload ? (
                                        <div className="text-center py-10">
                                            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-gray-900 mb-2">Daily Limit Reached</h3>
                                            <p className="text-gray-600 mb-6">
                                                You've used all {uploadLimits.limit} of your daily video translations.
                                                {isTimerActive && timeRemaining && (
                                                    <span className="block mt-2">
                                                        Next video will be available <span className="font-medium">{timeRemaining}</span>
                                                    </span>
                                                )}
                                            </p>
                                            <Link
                                                href="/dashboard/manage-plan"
                                                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
                                            >
                                                Upgrade Your Plan
                                            </Link>
                                        </div>
                                    ) : (
                                        <>
                                            <VideoDropzone
                                                onVideoSelected={handleVideoSelected}
                                                isProcessing={processingState !== "idle" && processingState !== "error"}
                                            />

                                            {/* Show original video preview if available */}
                                            {originalVideoUrl && processingState === "idle" && (
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
                                                disabled={processingState !== "idle" && processingState !== "error"}
                                            />

                                            <div className="mt-8 flex justify-center">
                                                <button
                                                    onClick={processVideo}
                                                    disabled={!videoSource || (processingState !== "idle" && processingState !== "error")}
                                                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {processingState !== "idle" && processingState !== "error" ? (
                                                        <span className="flex items-center">
                                                            <Loader2 className="animate-spin h-5 w-5 mr-2" />
                                                            {processingState === "uploading" && "Uploading..."}
                                                            {processingState === "processing" && "Processing..."}
                                                            {processingState === "downloading" && "Finalizing..."}
                                                        </span>
                                                    ) : (
                                                        "Start Processing"
                                                    )}
                                                </button>
                                            </div>

                                            {/* Progress bar */}
                                            {processingState !== "idle" && processingState !== "error" && processingState !== "completed" && (
                                                <div className="mt-6">
                                                    <div className="relative pt-1">
                                                        <div className="flex mb-2 items-center justify-between">
                                                            <div>
                                                                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                                                                  {processingState === "uploading"
                                                                      ? "Uploading"
                                                                      : processingState === "processing"
                                                                          ? "Processing"
                                                                          : "Finalizing"}
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
                                            {originalVideoUrl &&
                                                processingState !== "idle" &&
                                                processingState !== "error" &&
                                                processingState !== "completed" && (
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
                                        </>
                                    )}

                                    {errorMessage && <div className="mt-4 text-center text-red-600">{errorMessage}</div>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}