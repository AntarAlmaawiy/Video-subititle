'use client';

import {useCallback, useState} from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Loader2 } from 'lucide-react';

interface VideoDropzoneProps {
    onVideoSelected: (file: File | null, type: 'file') => void;
    isProcessing: boolean;
}

const VideoDropzone = ({ onVideoSelected, isProcessing }: VideoDropzoneProps) => {
    const [error, setError] = useState<string | null>(null);

    // Create a state to track the selected file, separate from react-dropzone's state
    const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);

    const onDrop = useCallback(
        (acceptedFiles: File[]) => {
            if (acceptedFiles.length === 0) return;

            const file = acceptedFiles[0];
            if (!file.type.startsWith('video/')) {
                setError('Please upload a valid video file');
                return;
            }

            setError(null);
            setSelectedVideoFile(file);
            onVideoSelected(file, 'file');
        },
        [onVideoSelected]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm'],
        },
        disabled: isProcessing,
        maxFiles: 1,
    });

    const handleRemoveFile = (e: React.MouseEvent) => {
        e.stopPropagation();

        // Reset our own state
        setSelectedVideoFile(null);

        // Reset the file input
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }

        // Notify parent component
        onVideoSelected(null, 'file');
    };

    return (
        <div className="max-w-2xl mx-auto py-8">
            <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-indigo-400'
                } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <input {...getInputProps()} />

                {selectedVideoFile ? (
                    <div className="flex items-center justify-between p-2 bg-gray-100 rounded">
                        <div className="flex items-center">
                            <Upload className="h-5 w-5 text-indigo-600 mr-2" />
                            <span className="text-sm truncate max-w-xs">{selectedVideoFile.name}</span>
                        </div>
                        <button
                            onClick={handleRemoveFile}
                            disabled={isProcessing}
                            className="text-gray-500 hover:text-red-500"
                            type="button"
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

            {error && <p className="text-red-600 mt-2 text-sm">{error}</p>}

            {isProcessing && (
                <div className="mt-4 flex items-center justify-center text-indigo-600">
                    <Loader2 className="animate-spin h-5 w-5 mr-2" />
                    <span>Processing your video...</span>
                </div>
            )}
        </div>
    );
};

export default VideoDropzone;