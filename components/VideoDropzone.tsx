'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Link as LinkIcon, X, Loader2 } from 'lucide-react';

type UploadMethod = 'file' | 'link';

interface VideoDropzoneProps {
    onVideoSelected: (file: File | string, type: 'file' | 'link') => void;
    isProcessing: boolean;
}

const VideoDropzone = ({ onVideoSelected, isProcessing }: VideoDropzoneProps) => {
    const [uploadMethod, setUploadMethod] = useState<UploadMethod>('file');
    const [videoLink, setVideoLink] = useState('');
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const file = acceptedFiles[0];
            if (!file.type.startsWith('video/')) {
                setError('Please upload a valid video file');
                return;
            }

            setError(null);
            onVideoSelected(file, 'file');
        },
        [onVideoSelected]
    );

    const handleLinkSubmit = () => {
        if (!videoLink) {
            setError('Please enter a video URL');
            return;
        }

        try {
            new URL(videoLink);
            setError(null);
            onVideoSelected(videoLink, 'link');
        } catch (e) {
            setError('Please enter a valid URL');
        }
    };

    const { getRootProps, getInputProps, isDragActive, acceptedFiles } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
        },
        disabled: isProcessing,
        maxFiles: 1,
    });

    const selectedFile = acceptedFiles[0];

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div className="flex justify-center mb-6">
                <div className="flex rounded-md overflow-hidden">
                    <button
                        onClick={() => setUploadMethod('file')}
                        className={`px-4 py-2 ${
                            uploadMethod === 'file'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        disabled={isProcessing}
                    >
                        Upload File
                    </button>
                    <button
                        onClick={() => setUploadMethod('link')}
                        className={`px-4 py-2 ${
                            uploadMethod === 'link'
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                        disabled={isProcessing}
                    >
                        Video URL
                    </button>
                </div>
            </div>

            {uploadMethod === 'file' ? (
                <div
                    {...getRootProps()}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                        isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <input {...getInputProps()} />

                    {selectedFile ? (
                        <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                            <div className="flex items-center">
                                <Upload className="h-5 w-5 text-indigo-600 mr-2" />
                                <span className="text-sm truncate max-w-xs">{selectedFile.name}</span>
                            </div>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    acceptedFiles.slice(0, acceptedFiles.length);
                                    // Force update by causing a re-render
                                    onDrop([]);
                                }}
                                disabled={isProcessing}
                                className="text-gray-500 hover:text-red-500"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    ) : (
                        <div>
                            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600">
                                Drag and drop a video file here, or click to select a file
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Supported formats: MP4, MOV, AVI, MKV, WebM (Max 500MB)
                            </p>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center border rounded overflow-hidden">
                        <div className="px-3 py-2 bg-gray-100">
                            <LinkIcon className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                            type="text"
                            value={videoLink}
                            onChange={(e) => setVideoLink(e.target.value)}
                            placeholder="Paste a YouTube, Vimeo or other video URL"
                            className="flex-1 px-4 py-2 focus:outline-none"
                            disabled={isProcessing}
                        />
                    </div>
                    <button
                        onClick={handleLinkSubmit}
                        disabled={isProcessing}
                        className="w-full py-2 px-4 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <span className="flex items-center justify-center">
                <Loader2 className="animate-spin h-5 w-5 mr-2" />
                Processing...
              </span>
                        ) : (
                            'Use this URL'
                        )}
                    </button>
                </div>
            )}

            {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}
        </div>
    );
};

export default VideoDropzone;