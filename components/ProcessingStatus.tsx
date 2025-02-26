'use client';

import { Loader, CheckCircle, X, AlertTriangle } from 'lucide-react';

type ProcessingState = 'idle' | 'uploading' | 'transcribing' | 'translating' | 'embedding' | 'completed' | 'error';

interface ProcessingStatusProps {
    state: ProcessingState;
    progress: number;
    error: string | null;
}

const ProcessingStatus = ({ state, progress, error }: ProcessingStatusProps) => {
    const steps = [
        { id: 'uploading', name: 'Uploading video' },
        { id: 'transcribing', name: 'Transcribing audio' },
        { id: 'translating', name: 'Translating content' },
        { id: 'embedding', name: 'Embedding subtitles' },
    ];

    // Map processing state to step index
    const currentStepIndex = steps.findIndex((step) => step.id === state);

    const getStepStatus = (stepId: string) => {
        const stepIndex = steps.findIndex((step) => step.id === stepId);

        if (state === 'error') {
            // If error state, mark current step as error and previous steps as completed
            if (stepIndex === currentStepIndex) return 'error';
            if (stepIndex < currentStepIndex) return 'complete';
            return 'upcoming';
        }

        if (stepIndex < currentStepIndex) return 'complete';
        if (stepIndex === currentStepIndex) return 'current';
        return 'upcoming';
    };

    return (
        <div className="mt-8 max-w-md mx-auto">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Processing your video</h3>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2.5 mb-6">
                <div
                    className={`h-2.5 rounded-full ${state === 'error' ? 'bg-red-600' : 'bg-indigo-600'}`}
                    style={{ width: `${progress}%` }}
                ></div>
            </div>

            {/* Status Steps */}
            <div className="space-y-4">
                {steps.map((step) => {
                    const status = getStepStatus(step.id);

                    return (
                        <div key={step.id} className="flex items-center">
                            <div className="flex-shrink-0">
                                {status === 'complete' && (
                                    <CheckCircle className="h-6 w-6 text-green-500" />
                                )}
                                {status === 'current' && (
                                    <Loader className="h-6 w-6 text-indigo-500 animate-spin" />
                                )}
                                {status === 'error' && (
                                    <AlertTriangle className="h-6 w-6 text-red-500" />
                                )}
                                {status === 'upcoming' && (
                                    <div className="h-6 w-6 border-2 border-gray-300 rounded-full"></div>
                                )}
                            </div>
                            <div className="ml-3">
                                <p
                                    className={`text-sm font-medium ${
                                        status === 'complete' ? 'text-green-800' :
                                            status === 'current' ? 'text-indigo-800' :
                                                status === 'error' ? 'text-red-800' :
                                                    'text-gray-500'
                                    }`}
                                >
                                    {step.name}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Error message */}
            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                        <X className="h-5 w-5 text-red-500" />
                        <p className="ml-2 text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcessingStatus;