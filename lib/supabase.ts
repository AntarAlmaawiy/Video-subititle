// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// User authentication functions
export const signUpWithEmail = async (email: string, password: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username },
        },
    });

    if (error) throw error;
    return data;
};

// Video storage functions
export const uploadVideoToSupabase = async (file: File, userId: string, fileName: string) => {
    // Create a unique path for the user's video
    const filePath = `users/${userId}/videos/${Date.now()}_${fileName}`;

    // Upload the file to Supabase Storage
    const { data, error } = await supabase.storage
        .from('videos')
        .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
        });

    if (error) throw error;
    return data;
};

// Upload processed video with subtitles - Without bucket verification
export const uploadProcessedVideo = async (file: File | Blob, userId: string, fileName: string, metadata: any) => {
    console.log(`Uploading processed video: ${fileName} for user ${userId}`);

    try {
        // Create a unique path for the user's processed video
        const filePath = `users/${userId}/processed/${Date.now()}_${fileName}`;

        // Log the file details
        console.log('File details:', {
            name: fileName,
            size: file instanceof File ? file.size : 'blob',
            type: file.type || 'video/mp4',
            userId,
            path: filePath
        });

        // Upload the file to Supabase Storage with more detailed error handling
        const { data, error } = await supabase.storage
            .from('videos')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true, // Changed to true to overwrite if exists
                contentType: file.type || 'video/mp4'
            });

        if (error) {
            console.error('Storage upload error details:', {
                message: error.message,
                name: error.name,
                errorObject: JSON.stringify(error, Object.getOwnPropertyNames(error))
            });
            throw new Error(`Storage upload failed: ${error.message || 'Unknown error'}`);
        }

        if (!data) {
            throw new Error('Upload returned no data');
        }

        console.log('File uploaded successfully to path:', filePath);

        // Get public URL for the uploaded file
        const publicUrl = getPublicUrl(filePath);

        // Verify metadata before inserting
        const sanitizedMetadata = {
            language: metadata.language || 'unknown',
            source_language: metadata.sourceLanguage || 'unknown',
            duration: typeof metadata.duration === 'number' ? metadata.duration : 0,
            created_at: new Date().toISOString()
        };

        console.log('Inserting record with metadata:', sanitizedMetadata);

        // Add record to the video_library table
        const { error: dbError, data: dbData } = await supabase
            .from('video_library')
            .insert([{
                user_id: userId,
                file_path: filePath,
                file_name: fileName,
                language: sanitizedMetadata.language,
                source_language: sanitizedMetadata.source_language,
                duration: sanitizedMetadata.duration,
                created_at: sanitizedMetadata.created_at
            }])
            .select();

        if (dbError) {
            console.error('Database insert error:', {
                message: dbError.message,
                code: dbError.code,
                details: dbError.details,
                hint: dbError.hint
            });

            // If database insert fails, try to clean up the uploaded file
            await supabase.storage.from('videos').remove([filePath]);

            throw new Error(`Database record creation failed: ${dbError.message || 'Unknown error'}`);
        }

        console.log('Database record created successfully:', dbData);

        return {
            path: filePath,
            publicUrl: publicUrl,
            record: dbData?.[0] || null
        };
    } catch (error) {
        // Convert any error to a proper Error object
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown error during video upload';

        console.error('Error in uploadProcessedVideo:', error);
        throw new Error(errorMessage);
    }
};

// Get user's video library - With improved error handling
export const getUserVideos = async (userId: string) => {
    console.log(`Fetching videos for user: ${userId}`);

    try {
        const { data, error } = await supabase
            .from('video_library')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user videos:', error);
            throw new Error(`Failed to fetch videos: ${error.message}`);
        }

        if (!data || data.length === 0) {
            console.log('No videos found for user');
            return [];
        }

        console.log(`Found ${data.length} videos for user`);

        // Add public URLs to each video
        const videosWithUrls = await Promise.all(data.map(async (video) => {
            const signedUrl = await getReliableVideoUrl(video.file_path);
            return {
                ...video,
                publicUrl: signedUrl
            };
        }));

        return videosWithUrls;
    } catch (error) {
        console.error('Error in getUserVideos:', error);
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown error fetching videos';
        throw new Error(errorMessage);
    }
};

// Delete a video
export const deleteUserVideo = async (userId: string, fileId: string, filePath: string) => {
    console.log(`Deleting video: ${fileId} at path ${filePath} for user ${userId}`);

    try {
        // First delete from storage
        const { error: storageError } = await supabase.storage
            .from('videos')
            .remove([filePath]);

        if (storageError) {
            console.error('Storage delete error:', storageError);
            throw new Error(`Failed to delete file: ${storageError.message}`);
        }

        console.log('File deleted from storage successfully');

        // Then delete from the database
        const { error: dbError } = await supabase
            .from('video_library')
            .delete()
            .eq('id', fileId)
            .eq('user_id', userId); // Ensure the user owns this video

        if (dbError) {
            console.error('Database delete error:', dbError);
            throw new Error(`Failed to delete database record: ${dbError.message}`);
        }

        console.log('Database record deleted successfully');

        return { success: true };
    } catch (error) {
        console.error('Error in deleteUserVideo:', error);
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown error deleting video';
        throw new Error(errorMessage);
    }
};

// Get a public URL for a file
export const getPublicUrl = (filePath: string) => {
    try {
        // Make sure the path is properly formatted
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

        const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(cleanPath);

        return data.publicUrl;
    } catch (error) {
        console.error('Error generating public URL:', error);
        return '';
    }
};

// Get a reliable video URL using signed URLs (better for authenticated content)
export const getReliableVideoUrl = async (filePath: string) => {
    try {
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

        // Create a signed URL with longer expiry (1 hour)
        const { data, error } = await supabase.storage
            .from('videos')
            .createSignedUrl(cleanPath, 3600);

        if (error) {
            console.error('Error creating signed URL:', error);
            // Fall back to public URL if signed URL fails
            return getPublicUrl(filePath);
        }

        return data?.signedUrl || getPublicUrl(filePath);
    } catch (error) {
        console.error('Error getting reliable video URL:', error);
        // Fall back to public URL as a last resort
        return getPublicUrl(filePath);
    }
};
// Add this to lib/supabase.ts

export const getUserStorageStats = async (userId: string) => {
    try {
        // Get all videos for the user
        const { data: videos, error } = await supabase
            .from('video_library')
            .select('*')
            .eq('user_id', userId);

        if (error) throw error;

        // Initialize default stats
        const stats = {
            totalSize: 0,
            videoCount: videos?.length || 0,
            usedStorage: 0,
            maxStorage: 50 * 1024 * 1024 * 1024, // 50GB default limit
            formatBreakdown: [] as { name: string; value: number; count: number }[]
        };

        if (!videos || videos.length === 0) {
            return stats;
        }

        // Process videos to calculate storage data
        const formatMap = new Map<string, { size: number; count: number }>();

        for (const video of videos) {
            // Get file metadata from Storage if available
            try {
                const { data, error: metadataError } = await supabase.storage.from('videos').getPublicUrl(video.file_path);

                // Estimate size based on video duration (fallback method)
                // Average 5MB per minute of video as a rough estimate
                const estimatedSize = video.duration ? video.duration * 5 * 1024 * 1024 / 60 : 10 * 1024 * 1024;
                stats.totalSize += estimatedSize;

                // Extract format from filename
                const format = video.file_name.split('.').pop()?.toLowerCase() || 'unknown';

                if (!formatMap.has(format)) {
                    formatMap.set(format, { size: 0, count: 0 });
                }

                const formatStats = formatMap.get(format)!;
                formatStats.size += estimatedSize;
                formatStats.count += 1;
                formatMap.set(format, formatStats);
            } catch (e) {
                console.error('Error getting video metadata:', e);
            }
        }

        // Convert format map to array for chart
        stats.formatBreakdown = Array.from(formatMap.entries()).map(([name, data]) => ({
            name,
            value: data.size,
            count: data.count
        }));

        stats.usedStorage = stats.totalSize;

        return stats;
    } catch (error) {
        console.error('Error in getUserStorageStats:', error);
        throw error;
    }
};
// Add these functions to your lib/supabase.ts file

// Get user's subscription plan from database
export const getUserSubscription = async (userId: string) => {
    try {
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            console.error('Error fetching user subscription:', error);
            // If no subscription found, return free plan defaults
            if (error.code === 'PGRST116') {
                return {
                    plan_id: 'free',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    stripe_subscription_id: null,
                    stripe_customer_id: null
                };
            }
            throw error;
        }

        return data;
    } catch (error) {
        console.error('Error in getUserSubscription:', error);
        // Return default free plan if there's an error
        return {
            plan_id: 'free',
            status: 'active',
            next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            stripe_subscription_id: null,
            stripe_customer_id: null
        };
    }
};

// Update user's subscription in database
export const updateUserSubscription = async (
    userId: string,
    subscriptionData: {
        plan_id: string;
        status: string;
        next_billing_date: string;
        stripe_subscription_id?: string;
        stripe_customer_id?: string;
    }
) => {
    try {
        // Check if subscription exists
        const { data: existingSubscription, error: checkError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
            throw checkError;
        }

        if (existingSubscription) {
            // Update existing subscription
            const { error: updateError } = await supabase
                .from('user_subscriptions')
                .update({
                    plan_id: subscriptionData.plan_id,
                    status: subscriptionData.status,
                    next_billing_date: subscriptionData.next_billing_date,
                    stripe_subscription_id: subscriptionData.stripe_subscription_id,
                    stripe_customer_id: subscriptionData.stripe_customer_id,
                    updated_at: new Date().toISOString()
                })
                .eq('user_id', userId);

            if (updateError) throw updateError;
        } else {
            // Insert new subscription
            const { error: insertError } = await supabase
                .from('user_subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: subscriptionData.plan_id,
                    status: subscriptionData.status,
                    next_billing_date: subscriptionData.next_billing_date,
                    stripe_subscription_id: subscriptionData.stripe_subscription_id,
                    stripe_customer_id: subscriptionData.stripe_customer_id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (insertError) throw insertError;
        }

        return { success: true };
    } catch (error) {
        console.error('Error updating user subscription:', error);
        throw error;
    }
};

// Get user's daily video usage
export const getUserDailyVideoUsage = async (userId: string) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const tomorrow = new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0];

        // Query for videos created today
        const { data, error } = await supabase
            .from('video_library')
            .select('id, created_at')
            .eq('user_id', userId)
            .gte('created_at', today)
            .lt('created_at', tomorrow);

        if (error) throw error;

        return {
            count: data?.length || 0
        };
    } catch (error) {
        console.error('Error getting daily video usage:', error);
        throw error;
    }
};

// Check if user can upload more videos today based on their subscription
export const canUploadMoreVideos = async (userId: string) => {
    try {
        // Get user's subscription
        const subscription = await getUserSubscription(userId);

        // Get daily usage
        const dailyUsage = await getUserDailyVideoUsage(userId);

        // Define limits based on plan
        const limits = {
            free: 1,
            pro: 10,
            elite: 30
        };

        const planLimit = limits[subscription.plan_id as keyof typeof limits] || limits.free;

        return {
            canUpload: dailyUsage.count < planLimit,
            currentCount: dailyUsage.count,
            limit: planLimit,
            remaining: Math.max(0, planLimit - dailyUsage.count)
        };
    } catch (error) {
        console.error('Error checking upload limits:', error);
        throw error;
    }
};


// Function to force download a file
export const forceDownloadFile = async (filePath: string, fileName: string) => {
    try {
        console.log(`Preparing download for file: ${filePath}`);

        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

        // Try to get a direct download URL
        const { data, error } = await supabase.storage
            .from('videos')
            .createSignedUrl(cleanPath, 60); // 60 seconds expiry

        if (error) {
            console.error('Error creating download URL:', error);
            throw new Error(`Failed to generate download link: ${error.message}`);
        }

        if (!data?.signedUrl) {
            throw new Error('No download URL was generated');
        }

        console.log('Successfully generated download URL');

        // Create a temporary link element to trigger the download
        const link = document.createElement('a');
        link.href = data.signedUrl;
        link.download = fileName || 'video.mp4'; // Force download with specific filename
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;
    } catch (error) {
        console.error('Download error:', error);
        throw error;
    }
};