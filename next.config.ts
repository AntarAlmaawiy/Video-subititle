import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Enable environment variables to be available in the application
    env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    },

    // Configure API routes
    api: {
        // Increase body parser size limit for video uploads
        bodyParser: {
            sizeLimit: '50mb',
        },
        // Increase response limit for processed videos
        responseLimit: false,
    },

    // Experimental features
    experimental: {
        // Allow larger server response size for videos
        largePageDataBytes: 128 * 1024 * 1024,
    },

    // Configure headers to allow CORS and FFmpeg WASM headers
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Credentials', value: 'true' },
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
                    { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
                ],
            },
            {
                source: "/(ffmpeg-core\\..*)",
                headers: [
                    {
                        key: "Cross-Origin-Embedder-Policy",
                        value: "require-corp",
                    },
                    {
                        key: "Cross-Origin-Opener-Policy",
                        value: "same-origin",
                    },
                ],
            },
        ];
    },

    // Webpack configuration for FFmpeg and WebAssembly support
    webpack(config) {
        config.resolve.fallback = {
            ...config.resolve.fallback,
            fs: false,
            path: false,
        };

        // Support WebAssembly
        config.experiments = {
            ...config.experiments,
            asyncWebAssembly: true,
        };

        return config;
    },
};

export default nextConfig;
