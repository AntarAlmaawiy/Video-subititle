// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables!');
}

// Create the Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
    },
    global: {
        headers: {
            'apikey': supabaseAnonKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Client-Info': 'supabase-js/2.x'
        },
    },
});
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

// Get user's subscription plan from database
export const getUserSubscription = async (userId?: string) => {
    try {
        if (!userId) {
            console.log('No user ID provided to getUserSubscription, returning default');
            return getDefaultSubscription();
        }

        console.log(`Fetching subscription for user: ${userId}`);

        // Use a more direct query approach
        const { data: subData, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .select(`
                *,
                plan_details:subscription_plans(*)
            `)
            .maybeSingle();

        console.log('Subscription query result:', { data: subData, error: subError });

        if (!subError && subData) {
            console.log('Found subscription record:', subData);
            return subData;
        }

        // If we reach here, either there was an error or no subscription was found
        console.log(`No subscription found for user ${userId}, returning default free plan`);
        return getDefaultSubscription();
    } catch (error) {
        console.error('Error in getUserSubscription:', error);
        return getDefaultSubscription();
    }
};

function getDefaultSubscription() {
    return {
        plan_id: 'free',
        status: 'active',
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        stripe_subscription_id: null,
        stripe_customer_id: null
    };
}

// // Update or create a user's subscription in the database
// // This is a server-side only function - it should only be called from API routes
// export const upsertUserSubscription = async (
//     userId: string,
//     subscriptionData: {
//         plan_id: string;
//         status: string;
//         next_billing_date?: string;
//         stripe_subscription_id?: string | null;
//         stripe_customer_id?: string | null;
//         billing_cycle?: 'monthly' | 'yearly';
//     }
// ) => {
//     // This will be implemented in the API routes using the admin client
//     console.error('upsertUserSubscription should not be called from client code');
//     throw new Error('This function can only be called from server-side code');
// };
//
// // Legacy function maintained for compatibility
// export const updateUserSubscription = async (
//     userId: string,
//     subscriptionData: {
//         plan_id: string;
//         status: string;
//         next_billing_date: string;
//         stripe_subscription_id?: string | null;
//         stripe_customer_id?: string | null;
//     }
// ) => {
//     console.error('updateUserSubscription should not be called from client code');
//     throw new Error('This function can only be called from server-side code');
// };



// Update or create a user's subscription in the database
// This is a server-side only function - it should only be called from API routes
export const upsertUserSubscription = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _userId: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _subscriptionData: {
        plan_id: string;
        status: string;
        next_billing_date?: string;
        stripe_subscription_id?: string | null;
        stripe_customer_id?: string | null;
        billing_cycle?: 'monthly' | 'yearly';
    }
) => {
    // This will be implemented in the API routes using the admin client
    console.error('upsertUserSubscription should not be called from client code');
    throw new Error('This function can only be called from server-side code');
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
export const uploadProcessedVideo = async (file: File | Blob, userId: string, fileName: string, metadata: Record<string, unknown>) => {
    console.log(`Uploading processed video: ${fileName} for user ${userId}`);

    try {
        // First check if the user can upload more videos
        const uploadLimits = await canUploadMoreVideos(userId);
        if (!uploadLimits.canUpload) {
            throw new Error(`Daily upload limit reached (${uploadLimits.limit} videos per day)`);
        }

        // Check if user is over storage limit
        const isOverStorageLimit = await isUserOverStorageLimit(userId);
        if (isOverStorageLimit) {
            throw new Error(`Storage limit reached. Please upgrade your plan or delete some videos.`);
        }

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
        if (!userId) {
            console.error('Invalid user ID provided');
            return [];
        }

        const { data, error } = await supabase
            .from('video_library')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching user videos:', error);
            // Return empty array instead of throwing
            return [];
        }

        if (!data || data.length === 0) {
            console.log('No videos found for user');
            return [];
        }

        console.log(`Found ${data.length} videos for user`);

        // Add public URLs to each video
        const videosWithUrls = await Promise.all(data.map(async (video) => {
            try {
                // Try to get a signed URL first
                console.log(`Getting URL for video: ${video.id} - Path: ${video.file_path}`);
                const signedUrl = await getReliableVideoUrl(video.file_path);

                return {
                    ...video,
                    publicUrl: signedUrl || getPublicUrl(video.file_path) // Fallback to public URL if signed fails
                };
            } catch (error) {
                console.error(`Error getting URL for video ${video.id}:`, error);
                // Return the video with a public URL if we couldn't get the signed one
                return {
                    ...video,
                    publicUrl: getPublicUrl(video.file_path)
                };
            }
        }));

        return videosWithUrls;
    } catch (error) {
        console.error('Error in getUserVideos:', error);
        const errorMessage = error instanceof Error
            ? error.message
            : 'Unknown error fetching videos';
        console.log(errorMessage);
        // Return empty array instead of throwing
        return [];
    }
};


/**
 * Records that a user has processed a video, updating their usage count
 * This is called when video processing is complete, even if the user doesn't save to library
 */
export async function recordVideoProcessed(userId: string): Promise<void> {
    if (!userId) return;

    try {
        console.log(`Recording video processing usage for user: ${userId}`);

        // Get the current date in UTC (YYYY-MM-DD format)
        const today = new Date().toISOString().split('T')[0];

        // First check if we have an entry for today
        const { data, error } = await supabase
            .from('video_processing_usages')
            .select('count')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is expected for first usage
            console.error('Error checking video processing usage:', error);
            throw error;
        }

        if (data) {
            // Update existing record
            const { error: updateError } = await supabase
                .from('video_processing_usages')
                .update({ count: data.count + 1 })
                .eq('user_id', userId)
                .eq('date', today);

            if (updateError) {
                console.error('Error updating video processing count:', updateError);
                throw updateError;
            }

            console.log(`Updated processing count to ${data.count + 1} for today`);
        } else {
            // Insert new record
            const { error: insertError } = await supabase
                .from('video_processing_usages')
                .insert({
                    user_id: userId,
                    date: today,
                    count: 1
                });

            if (insertError) {
                console.error('Error inserting video processing usage:', insertError);
                throw insertError;
            }

            console.log('Created new processing usage record for today');
        }
    } catch (error) {
        console.error('Error in recordVideoProcessed:', error);
        // Don't throw, just log the error to prevent breaking the user experience
    }
}

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
        if (!filePath) {
            console.error('Invalid file path provided to getPublicUrl:', filePath);
            return '';
        }

        // Make sure the path is properly formatted
        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        console.log(`Getting public URL for: ${cleanPath}`);

        const { data } = supabase.storage
            .from('videos')
            .getPublicUrl(cleanPath);

        if (!data?.publicUrl) {
            console.warn('No public URL returned for path:', cleanPath);
            return '';
        }

        console.log(`Generated public URL successfully`);
        return data.publicUrl;
    } catch (error) {
        console.error('Error generating public URL:', error);
        return '';
    }
};

// Get a reliable video URL using signed URLs (better for authenticated content)
export const getReliableVideoUrl = async (filePath: string) => {
    try {
        if (!filePath) {
            console.error('Invalid file path provided:', filePath);
            return '';
        }

        const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
        console.log(`Getting reliable URL for: ${cleanPath}`);

        // First try to create a signed URL with longer expiry (1 hour)
        const { data, error } = await supabase.storage
            .from('videos')
            .createSignedUrl(cleanPath, 3600);

        if (error) {
            console.error('Error creating signed URL:', error);
            // Fall back to public URL if signed URL fails
            const publicUrl = getPublicUrl(filePath);
            console.log(`Falling back to public URL: ${publicUrl}`);
            return publicUrl;
        }

        if (data?.signedUrl) {
            console.log(`Generated signed URL successfully`);
            return data.signedUrl;
        } else {
            console.log(`No signed URL returned, falling back to public URL`);
            return getPublicUrl(filePath);
        }
    } catch (error) {
        console.error('Error getting reliable video URL:', error);
        // Fall back to public URL as a last resort
        return getPublicUrl(filePath);
    }
};

// Helper function to format bytes for logging
function formatBytes(bytes: number) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Update this function in your supabase.ts file
export const getUserStorageStats = async (userId: string) => {
    try {
        console.log(`Getting storage stats for user: ${userId}`);

        // Get user's subscription first to determine storage limit
        const subscription = await getUserSubscription(userId);
        console.log("Retrieved subscription for storage stats:", subscription);

        // Define storage limits based on plan (fallback values)
        const storageLimits = {
            free: 500 * 1024 * 1024, // 500MB
            pro: 5 * 1024 * 1024 * 1024, // 5GB instead of 15GB
            elite: 10 * 1024 * 1024 * 1024 // 10GB
        };

        // Set the storage limit
        let storageLimit = 500 * 1024 * 1024; // Default 500MB (free plan)

        // Use storage_bytes from plan_details if available
        if (subscription.plan_details && subscription.plan_details.storage_bytes) {
            storageLimit = subscription.plan_details.storage_bytes;
            console.log(`Using storage limit from database: ${formatBytes(storageLimit)}`);
        } else {
            // Get storage limit with fallback to free plan if the plan_id is unexpected
            storageLimit = subscription && subscription.plan_id &&
            storageLimits[subscription.plan_id as keyof typeof storageLimits] !== undefined
                ? storageLimits[subscription.plan_id as keyof typeof storageLimits]
                : storageLimits.free;

            console.log(`Using hardcoded storage limit: ${formatBytes(storageLimit)}`);
        }

        // Get all videos for the user
        const { data: videos, error } = await supabase
            .from('video_library')
            .select('*')
            .eq('user_id', userId);

        if (error) {
            console.error('Error querying video library for storage stats:', error);
            // Return default values with the correct plan limit
            return {
                totalSize: 0,
                videoCount: 0,
                usedStorage: 0,
                maxStorage: storageLimit,
                formatBreakdown: []
            };
        }

        // Initialize default stats with the correct plan limit
        const stats = {
            totalSize: 0,
            videoCount: videos?.length || 0,
            usedStorage: 0,
            maxStorage: storageLimit,
            formatBreakdown: [] as { name: string; value: number; count: number }[]
        };

        if (!videos || videos.length === 0) {
            return stats;
        }

        // Process videos to calculate storage data
        const formatMap = new Map<string, { size: number; count: number }>();

        for (const video of videos) {
            try {
                // Estimate size based on video duration (fallback method)
                // Average 5MB per minute of video as a rough estimate
                const estimatedSize = video.duration ? video.duration * 5 * 1024 * 1024 / 60 : 10 * 1024 * 1024;
                stats.totalSize += estimatedSize;

                // Extract format from filename
                const format = video.file_name?.split('.').pop()?.toLowerCase() || 'unknown';

                if (!formatMap.has(format)) {
                    formatMap.set(format, { size: 0, count: 0 });
                }

                const formatStats = formatMap.get(format)!;
                formatStats.size += estimatedSize;
                formatStats.count += 1;
                formatMap.set(format, formatStats);
            } catch (e) {
                console.error('Error processing video for storage stats:', e);
                // Continue with the next video
            }
        }

        // Convert format map to array for chart
        stats.formatBreakdown = Array.from(formatMap.entries()).map(([name, data]) => ({
            name,
            value: data.size,
            count: data.count
        }));

        stats.usedStorage = stats.totalSize;

        console.log(`Storage stats calculated: ${formatBytes(stats.usedStorage)}/${formatBytes(stats.maxStorage)} used (${videos.length} videos)`);

        return stats;
    } catch (error) {
        console.error('Error in getUserStorageStats:', error);
        // Return default values with free plan limit
        return {
            totalSize: 0,
            videoCount: 0,
            usedStorage: 0,
            maxStorage: 500 * 1024 * 1024, // 500MB (free plan default)
            formatBreakdown: []
        };
    }
};

// Get user's daily video usage with timestamp tracking
export const getUserDailyVideoUsage = async (userId: string) => {
    try {
        if (!userId) {
            console.error('Invalid user ID provided');
            return {
                count: 0,
                uploads: [],
                nextUploadTime: undefined
            };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        console.log(`Checking today's video uploads for user: ${userId} (${today.toISOString()} to ${tomorrow.toISOString()})`);

        // Query for videos created today
        const { data, error } = await supabase
            .from('video_library')
            .select('id, created_at')
            .eq('user_id', userId)
            .gte('created_at', today.toISOString())
            .lt('created_at', tomorrow.toISOString())
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Error querying video library:', error);
            // Return default values instead of throwing
            return {
                count: 0,
                uploads: [],
                nextUploadTime: undefined
            };
        }

        // Calculate next available upload time (24 hours after first upload of the day)
        let nextUploadTime: Date | undefined = undefined;

        if (data && data.length > 0) {
            // Get the timestamp of the first video uploaded today
            const firstUploadToday = new Date(data[0].created_at);
            nextUploadTime = new Date(firstUploadToday);
            nextUploadTime.setHours(nextUploadTime.getHours() + 24);
            console.log(`First upload today was at ${firstUploadToday.toISOString()}, next upload available at ${nextUploadTime.toISOString()}`);
        }

        console.log(`Found ${data?.length || 0} videos uploaded today`);

        return {
            count: data?.length || 0,
            uploads: data || [],
            nextUploadTime: nextUploadTime
        };
    } catch (error) {
        console.error('Error getting daily video usage:', error);
        // Return default values instead of throwing
        return {
            count: 0,
            uploads: [],
            nextUploadTime: undefined
        };
    }
};

// Check if user can upload more videos today based on their subscription
// Modified canUploadMoreVideos function to check the video_processing_usages table
export const canUploadMoreVideos = async (userId: string) => {
    try {
        console.log(`Checking video upload limits for user: ${userId}`);

        // Get user's subscription - get plan details directly
        const subscription = await getUserSubscription(userId);
        console.log("Retrieved subscription for limit check:", {
            plan_id: subscription.plan_id,
            status: subscription.status
        });

        // Try to get the videos_per_day from plan_details if available
        let planLimit = 1; // Default to free plan limit

        if (subscription.plan_details && subscription.plan_details.videos_per_day) {
            // If we have the plan details from the database
            planLimit = subscription.plan_details.videos_per_day;
            console.log(`Using plan limit from database: ${planLimit} videos per day`);
        } else {
            // Fallback to hardcoded limits if plan_details aren't available
            const limits = {
                free: 1,
                pro: 10,
                elite: 30
            };

            // Get the plan limit, with a fallback to free plan limit if the plan_id is unexpected
            planLimit = subscription && subscription.plan_id &&
            limits[subscription.plan_id as keyof typeof limits] !== undefined
                ? limits[subscription.plan_id as keyof typeof limits]
                : limits.free;

            console.log(`Using hardcoded plan limit: ${planLimit} videos per day`);
        }

        // Get the current date in UTC (YYYY-MM-DD format)
        const today = new Date().toISOString().split('T')[0];

        // Query the video_processing_usages table to get today's usage count
        const { data: usageData, error } = await supabase
            .from('video_processing_usages')
            .select('count')
            .eq('user_id', userId)
            .eq('date', today)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is fine
            console.error('Error checking video usage:', error);
            // Return default values instead of throwing
            return {
                canUpload: true,
                currentCount: 0,
                limit: planLimit,
                remaining: planLimit,
                nextUploadTime: undefined
            };
        }

        const currentCount = usageData?.count || 0;
        const remaining = Math.max(0, planLimit - currentCount);
        const canUpload = currentCount < planLimit;

        // Calculate next upload time if needed (for free plan only)
        let nextUploadTime: Date | undefined = undefined;

        if (!canUpload && subscription.plan_id === 'free') {
            // Get the timestamp of the first video processed today
            // First, try to get from the video_processing_usages table
            const { data: firstProcessingData, error: firstProcessingError } = await supabase
                .from('video_processing_usages')
                .select('created_at')
                .eq('user_id', userId)
                .eq('date', today)
                .order('created_at', { ascending: true })
                .limit(1)
                .single();

            if (!firstProcessingError && firstProcessingData?.created_at) {
                // Use the timestamp from the processing table
                const firstProcessingTime = new Date(firstProcessingData.created_at);
                nextUploadTime = new Date(firstProcessingTime);
                nextUploadTime.setHours(nextUploadTime.getHours() + 24);
                console.log(`First processing today was at ${firstProcessingTime.toISOString()}, next upload available at ${nextUploadTime.toISOString()}`);
            } else {
                // Fallback: use today at midnight + 24 hours
                nextUploadTime = new Date(today);
                nextUploadTime.setDate(nextUploadTime.getDate() + 1);
                console.log(`Using fallback next upload time: ${nextUploadTime.toISOString()}`);
            }
        }

        return {
            canUpload,
            currentCount,
            limit: planLimit,
            remaining,
            nextUploadTime
        };
    } catch (error) {
        console.error('Error checking upload limits:', error);

        // Return conservative default values that allow at least some functionality
        return {
            canUpload: true,
            currentCount: 0,
            limit: 1, // Assume free plan limit
            remaining: 1,
            nextUploadTime: undefined
        };
    }
};

// Verify a user's subscription status
export const verifySubscription = async (userId: string) => {
    try {
        console.log(`Verifying subscription for user: ${userId}`);

        if (!userId) {
            console.error('Invalid user ID provided');
            return {
                isSubscribed: false,
                plan: 'free',
                status: 'none',
                details: null
            };
        }

        // Get current subscription directly from database for most up-to-date info
        const { data, error } = await supabase
            .from('user_subscriptions')
            .select(`
                *,
                plan:plan_id (*)
            `)
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log(`No subscription found for user ${userId}`);
                return {
                    isSubscribed: false,
                    plan: 'free',
                    status: 'none',
                    details: null
                };
            }
            throw error;
        }

        // Verify if the subscription is active
        const isActive = data.status === 'active' || data.status === 'trialing';

        console.log(`Subscription status for user ${userId}: ${data.status} (${isActive ? 'active' : 'inactive'})`);

        return {
            isSubscribed: isActive,
            plan: data.plan_id,
            status: data.status,
            details: data
        };
    } catch (error) {
        console.error('Error verifying subscription:', error);
        return {
            isSubscribed: false,
            plan: 'free',
            status: 'error',
            details: null
        };
    }
};

// Check if user is over storage limit
export const isUserOverStorageLimit = async (userId: string): Promise<boolean> => {
    try {
        if (!userId) {
            console.error('Invalid user ID provided');
            return false; // Default to allowing upload if we can't check
        }

        console.log(`Checking storage limit for user: ${userId}`);

        // Get storage stats for the user
        const storageStats = await getUserStorageStats(userId);

        // Calculate usage percentage
        const usagePercent = (storageStats.usedStorage / storageStats.maxStorage) * 100;

        console.log(`Storage usage: ${formatBytes(storageStats.usedStorage)}/${formatBytes(storageStats.maxStorage)} (${usagePercent.toFixed(2)}%)`);

        // Return true if user is over limit (100% or more usage)
        return usagePercent >= 100;
    } catch (error) {
        console.error('Error checking storage limit:', error);
        return false; // Default to allowing upload if check fails
    }
};

// Function to force download a file
export const forceDownloadFile = async (filePath: string, fileName: string) => {
    try {
        console.log(`Preparing download for file: ${filePath}`);

        if (!filePath) {
            throw new Error('Invalid file path provided');
        }

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