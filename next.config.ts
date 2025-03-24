import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    // Enable environment variables to be available in the application
    env: {
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        BACKEND_URL: "https://api.sub0-translate.com", // Update to use domain with HTTPS
    },

    // Add the images configuration here
    images: {
        domains: ['lh3.googleusercontent.com', '159.89.123.141', 'api.sub0-translate.com'], // Add your domain
    },

    // Experimental features
    experimental: {
        // Allow larger server response size for videos
        largePageDataBytes: 256 * 1024 * 1024, // Increase to 256MB
        // Add this new config for App Router server actions
        serverActions: {
            bodySizeLimit: '1000mb', // Increase to 1GB
        },
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
                // Add specific headers for proxy-video endpoint
                source: '/api/proxy-video',
                headers: [
                    { key: 'Transfer-Encoding', value: 'chunked' },
                    { key: 'Connection', value: 'keep-alive' },
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