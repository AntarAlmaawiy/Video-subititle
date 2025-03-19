import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/SessionProvider';
import ErrorReportToggle from "@/components/ErrorReportToggle";
import {Suspense} from "react";
import { Analytics } from "@vercel/analytics/react"

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
});

export const metadata: Metadata = {
    metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
    title: 'SubTranslate - AI-Powered Video Subtitle Translation',
    description: 'Automatically transcribe-audio, translate, and embed subtitles in your videos with our AI-powered tool.',
    keywords: 'video, subtitles, translation, AI, transcription, video processing',
    authors: [{ name: 'SubTranslate Team' }],
    category: 'Technology',
    openGraph: {
        title: 'SubTranslate - AI-Powered Video Subtitle Translation',
        description: 'Automatically transcribe-audio, translate, and embed subtitles in your videos with our AI-powered tool.',
        url: '/',
        siteName: 'SubTranslate',
        images: [
            {
                url: '/images/og-image.jpg',
                width: 1200,
                height: 630,
                alt: 'SubTranslate - AI-Powered Video Subtitle Translation',
            },
        ],
        locale: 'en_US',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'SubTranslate - AI-Powered Video Subtitle Translation',
        description: 'Automatically transcribe-audio, translate, and embed subtitles in your videos with our AI-powered tool.',
        images: ['/images/twitter-image.jpg'],
        creator: '@subtranslate',
    },
    icons: {
        icon: '/logo.svg',
        shortcut: '/logo.svg',
        apple: '/apple-touch-icon.png',
    },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" className={inter.variable}>
        <body>
        <SessionProvider>
            {children}
            <Suspense fallback={null}>
                <ErrorReportToggle />
            </Suspense>
        </SessionProvider>
        <Analytics />
        </body>
        </html>
    );
}