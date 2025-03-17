'use client';

import { Globe, Video, Download, Clock } from 'lucide-react';

const features = [
    {
        name: 'Multiple Language Support',
        description:
            'Support for over 100 languages with high-quality translations powered by advanced AI models.',
        icon: Globe,
    },
    {
        name: 'Video Processing',
        description:
            'Upload local videos from Tiktok, Youtube, Instagram and other platforms for automatic subtitle embedding.',
        icon: Video,
    },
    {
        name: 'Fast Processing',
        description:
            'Our optimized pipeline ensures quick turnaround times, even for longer videos.',
        icon: Clock,
    },
    {
        name: 'Download Options',
        description:
            'Download your videos with embedded subtitles in multiple formats, or get the subtitle files separately.',
        icon: Download,
    },
];

export default function Features() {
    return (
        <div id="features" className="py-12 bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="lg:text-center">
                    <h2 className="text-base text-indigo-600 font-semibold tracking-wide uppercase">Features</h2>
                    <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                        Everything you need for video subtitles
                    </p>
                    <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
                        Our AI-powered platform makes it easy to add translated subtitles to any video.
                    </p>
                </div>

                <div className="mt-10">
                    <dl className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
                        {features.map((feature) => (
                            <div key={feature.name} className="relative">
                                <dt>
                                    <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-indigo-500 text-white">
                                        <feature.icon className="h-6 w-6" aria-hidden="true" />
                                    </div>
                                    <p className="ml-16 text-lg leading-6 font-medium text-gray-900">{feature.name}</p>
                                </dt>
                                <dd className="mt-2 ml-16 text-base text-gray-500">{feature.description}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    );
}