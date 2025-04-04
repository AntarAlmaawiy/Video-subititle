//api/save-to-library/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize admin Supabase client with your existing environment variable names
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || '';

// Check if required environment variables are set
if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required Supabase environment variables');
}

// Create the client only if we have the required credentials
const getAdminSupabase = () => {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Supabase credentials are not configured');
    }
    return createClient(supabaseUrl, supabaseServiceKey);
};

export async function POST(request: NextRequest) {
    try {
        // Only create the client when handling a request
        const adminSupabase = getAdminSupabase();

        const { videoUrl, userId, fileName, metadata } = await request.json();

        if (!videoUrl || !userId || !fileName) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        console.log(`Server-side: Downloading video from ${videoUrl}`);

        // Fetch the video file server-side to bypass CORS
        const response = await fetch(videoUrl);

        if (!response.ok) {
            return NextResponse.json({
                error: `Failed to download video: ${response.status} ${response.statusText}`
            }, { status: 500 });
        }

        const videoBuffer = await response.arrayBuffer();

        // Upload to Supabase storage
        const filePath = `users/${userId}/processed/${Date.now()}_${fileName}`;

        const { error } = await adminSupabase.storage
            .from('videos')
            .upload(filePath, videoBuffer, {
                contentType: 'video/mp4',
                upsert: true
            });

        if (error) {
            throw error;
        }

        // Get the public URL
        const { data: urlData } = adminSupabase.storage
            .from('videos')
            .getPublicUrl(filePath);

        // Create database record
        const { data: dbData, error: dbError } = await adminSupabase
            .from('video_library')
            .insert([
                {
                    user_id: userId,
                    file_path: filePath,
                    file_name: fileName,
                    language: metadata.language || 'unknown',
                    source_language: metadata.sourceLanguage || 'unknown',
                    duration: metadata.duration || 0,
                    created_at: new Date().toISOString()
                }
            ])
            .select();

        if (dbError) {
            throw dbError;
        }

        return NextResponse.json({
            success: true,
            path: filePath,
            publicUrl: urlData?.publicUrl,
            record: dbData?.[0] || null
        });

    } catch (error) {
        console.error('Error saving to library:', error);
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}