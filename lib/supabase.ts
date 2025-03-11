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

// Get user's subscription plan from database
// Replace your getUserSubscription function with this improved version
export const getUserSubscription = async (userId: string) => {
    try {
        console.log(`Fetching subscription for user: ${userId}`);

        if (!userId) {
            console.error('Invalid user ID provided');
            return getDefaultSubscription();
        }

        // First try a simpler query without the join to see if we can get the basic subscription
        const { data: subData, error: subError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        // If we got basic subscription data, now try to get the plan details separately
        if (!subError && subData) {
            console.log('Found subscription record:', subData);

            try {
                // Get plan details in a separate query
                const { data: planData, error: planError } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .eq('id', subData.plan_id)
                    .single();

                if (!planError && planData) {
                    console.log('Found plan details:', planData);
                    return {
                        ...subData,
                        plan_details: planData
                    };
                }
            } catch (planFetchError) {
                console.error('Error fetching plan details:', planFetchError);
            }

            // Return subscription data even if we couldn't get plan details
            return subData;
        }

        // If no subscription found, return free plan defaults
        if (subError && subError.code === 'PGRST116') {
            console.log('No subscription found, defaulting to free plan');
            return getDefaultSubscription();
        }

        // For other errors, log but return a default subscription
        console.error('Error fetching subscription:', subError);
        return getDefaultSubscription();
    } catch (error) {
        console.error('Error in getUserSubscription:', error);
        return getDefaultSubscription();
    }
};

// Helper function to create a default subscription object
function getDefaultSubscription() {
    return {
        plan_id: 'free',
        status: 'active',
        next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        stripe_subscription_id: null,
        stripe_customer_id: null
    };
}

// Update or create a user's subscription in the database
export const upsertUserSubscription = async (
    userId: string,
    subscriptionData: {
        plan_id: string;
        status: string;
        next_billing_date?: string;
        stripe_subscription_id?: string | null;
        stripe_customer_id?: string | null;
        billing_cycle?: 'monthly' | 'yearly';
    }
) => {
    try {
        console.log(`Upserting subscription for user ${userId}:`, JSON.stringify(subscriptionData));

        if (!userId) {
            throw new Error('Invalid user ID provided');
        }

        // Check if subscription exists with detailed error handling
        const { data: existingSubscription, error: checkError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (checkError) {
            if (checkError.code !== 'PGRST116') {
                // This is a real error, not just "no rows returned"
                console.error('Error checking for existing subscription:', checkError.code, checkError.message);
                // Continue anyway rather than throwing - we'll try to insert
            } else {
                console.log(`No existing subscription found for user ${userId}, will create new one`);
            }
        } else {
            console.log(`Found existing subscription for user ${userId}:`, existingSubscription?.plan_id);
        }

        // Prepare the update data
        const updateData = {
            plan_id: subscriptionData.plan_id,
            status: subscriptionData.status,
            user_id: userId,
            updated_at: new Date().toISOString()
        } as any;

        // Add optional fields if provided
        if (subscriptionData.next_billing_date) {
            updateData.next_billing_date = subscriptionData.next_billing_date;
        }

        // Handle null values explicitly for stripe_subscription_id
        if (subscriptionData.stripe_subscription_id === null) {
            updateData.stripe_subscription_id = null;
        } else if (subscriptionData.stripe_subscription_id) {
            updateData.stripe_subscription_id = subscriptionData.stripe_subscription_id;
        }

        // Handle null values explicitly for stripe_customer_id
        if (subscriptionData.stripe_customer_id === null) {
            updateData.stripe_customer_id = null;
        } else if (subscriptionData.stripe_customer_id) {
            updateData.stripe_customer_id = subscriptionData.stripe_customer_id;
        }

        if (subscriptionData.billing_cycle) {
            updateData.billing_cycle = subscriptionData.billing_cycle;
        }

        let result;

        if (existingSubscription) {
            // Update existing subscription
            console.log(`Updating existing subscription for user ${userId} to plan ${subscriptionData.plan_id}`);
            const { data, error: updateError } = await supabase
                .from('user_subscriptions')
                .update(updateData)
                .eq('user_id', userId)
                .select();

            if (updateError) {
                console.error('Error updating subscription:', updateError.code, updateError.message);
                throw new Error(`Database update failed: ${updateError.message}`);
            }

            result = data;
            console.log(`Subscription updated successfully:`, data);
        } else {
            // Insert new subscription
            console.log(`Creating new subscription for user ${userId} with plan ${subscriptionData.plan_id}`);

            const insertData = {
                ...updateData,
                created_at: new Date().toISOString()
            };

            console.log('Insert data for subscription:', JSON.stringify(insertData));

            const { data, error: insertError } = await supabase
                .from('user_subscriptions')
                .insert(insertData)
                .select();

            if (insertError) {
                console.error('Error inserting subscription:', insertError.code, insertError.message);
                throw new Error(`Database insert failed: ${insertError.message}`);
            }

            result = data;
            console.log(`Subscription created successfully:`, data);
        }

        // Directly verify the database state after update
        const { data: verifyData, error: verifyError } = await supabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (verifyError) {
            console.error('Error verifying subscription after update:', verifyError);
        } else {
            console.log('Verified subscription in database after update:', verifyData);
        }

        return { success: true, data: result };
    } catch (error) {
        // Ensure we're logging the full error
        console.error('Error upserting user subscription:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message, error.stack);
        }
        throw error;
    }
};

// Update user's subscription in database - Legacy function maintained for compatibility
export const updateUserSubscription = async (
    userId: string,
    subscriptionData: {
        plan_id: string;
        status: string;
        next_billing_date: string;
        stripe_subscription_id?: string | null;
        stripe_customer_id?: string | null;
    }
) => {
    console.log('Legacy updateUserSubscription called, forwarding to upsertUserSubscription', {
        userId,
        subscriptionData
    });

    // Forward to the new, more robust function
    return await upsertUserSubscription(userId, subscriptionData);
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

// Get user's storage statistics with proper plan limits
export const getUserStorageStats = async (userId: string) => {
    try {
        console.log(`Getting storage stats for user: ${userId}`);

        // Get user's subscription first to determine storage limit
        const subscription = await getUserSubscription(userId);
        console.log("Retrieved subscription for storage stats:", subscription);

        let storageLimit = 5 * 1024 * 1024 * 1024; // Default 5GB (free plan)

        // Try to get the storage_gb from plan_details if available
        if (subscription.plan_details && subscription.plan_details.storage_gb) {
            // Convert GB to bytes
            storageLimit = subscription.plan_details.storage_gb * 1024 * 1024 * 1024;
            console.log(`Using storage limit from database: ${subscription.plan_details.storage_gb}GB (${storageLimit} bytes)`);
        } else {
            // Define storage limits based on plan
            const storageLimits = {
                free: 5 * 1024 * 1024 * 1024, // 5GB
                pro: 15 * 1024 * 1024 * 1024, // 15GB
                elite: 30 * 1024 * 1024 * 1024 // 30GB
            };

            // Get storage limit with fallback to free plan if the plan_id is unexpected
            storageLimit = subscription && subscription.plan_id &&
            storageLimits[subscription.plan_id as keyof typeof storageLimits] !== undefined
                ? storageLimits[subscription.plan_id as keyof typeof storageLimits]
                : storageLimits.free;

            console.log(`Using hardcoded storage limit: ${storageLimit} bytes`);
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
            maxStorage: 5 * 1024 * 1024 * 1024, // 5GB (free plan default)
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
// Check if user can upload more videos today based on their subscription
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

        // Get daily usage with timestamp data
        const dailyUsage = await getUserDailyVideoUsage(userId);
        console.log("Daily video usage:", {
            count: dailyUsage.count,
            hasNextUploadTime: !!dailyUsage.nextUploadTime
        });

        const canUpload = dailyUsage.count < planLimit;
        console.log(`Can upload more videos? ${canUpload} (${dailyUsage.count}/${planLimit})`);

        return {
            canUpload,
            currentCount: dailyUsage.count,
            limit: planLimit,
            remaining: Math.max(0, planLimit - dailyUsage.count),
            nextUploadTime: !canUpload && subscription.plan_id === 'free' ? dailyUsage.nextUploadTime : undefined
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