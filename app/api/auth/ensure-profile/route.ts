// app/api/auth/ensure-profile/route.ts - updated version
import { NextResponse } from 'next/server';
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { getAdminSupabase } from '@/lib/admin-supabase';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const userId = session.user.id;
        const userEmail = session.user.email || 'user@example.com';
        const userName = session.user.name || userEmail.split('@')[0];

        const adminSupabase = getAdminSupabase();

        // First check if a profile with this email already exists
        const { data: emailExists } = await adminSupabase
            .from('profiles')
            .select('id, email')
            .eq('email', userEmail)
            .maybeSingle();

        if (emailExists) {
            console.log(`Profile with email ${userEmail} already exists with id ${emailExists.id}`);

            // If the existing profile has a different user ID than our current session,
            // we need to handle this special case (likely a user who signed up with both methods)
            if (emailExists.id !== userId) {
                console.log(`Email exists but with different ID: ${emailExists.id} vs current ${userId}`);
                // We'll use the existing profile's ID for consistency

                // Check if there's a subscription for the existing ID
                const { data: existingSub } = await adminSupabase
                    .from('user_subscriptions')
                    .select('*')
                    .eq('user_id', emailExists.id)
                    .single();

                if (existingSub) {
                    return NextResponse.json({
                        success: true,
                        message: 'Profile with this email already exists with a different ID',
                        profile: emailExists,
                        subscription: existingSub
                    });
                }
            }
        }

        // Check if user exists in profiles
        const { data: existingProfile, error: profileError } = await adminSupabase
            .from('profiles')
            .select('id')
            .eq('id', userId)
            .single();

        let profileResult = null;
        let subscriptionResult = null;

        // Create profile if it doesn't exist
        if (profileError && profileError.code === 'PGRST116') {
            console.log(`Profile not found for user ${userId}, creating now...`);

            try {
                const { data: newProfile, error: createError } = await adminSupabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        username: userName,
                        email: userEmail,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    }, {
                        onConflict: 'id',  // This ensures we update on ID conflict
                        ignoreDuplicates: false // This updates existing records
                    })
                    .select();

                if (createError) {
                    // If we hit an email uniqueness constraint, try generating a unique email
                    if (createError.code === '23505' && createError.message.includes('profiles_email_key')) {
                        console.log('Email uniqueness constraint hit, trying with modified email');

                        // Add a suffix to the email to make it unique
                        const uniqueEmail = `${userEmail}_${userId.slice(0, 8)}`;

                        const { data: retryProfile, error: retryError } = await adminSupabase
                            .from('profiles')
                            .upsert({
                                id: userId,
                                username: userName,
                                email: uniqueEmail,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            }, {
                                onConflict: 'id',
                                ignoreDuplicates: false
                            })
                            .select();

                        if (retryError) {
                            console.error('Error creating profile with unique email:', retryError);
                            return NextResponse.json({ error: retryError.message }, { status: 500 });
                        }

                        profileResult = retryProfile;
                    } else {
                        console.error('Error creating profile:', createError);
                        return NextResponse.json({ error: createError.message }, { status: 500 });
                    }
                } else {
                    profileResult = newProfile;
                }
            } catch (err) {
                console.error('Exception creating profile:', err);
                return NextResponse.json({ error: String(err) }, { status: 500 });
            }
        } else if (profileError) {
            console.error('Error checking profile:', profileError);
            return NextResponse.json({ error: profileError.message }, { status: 500 });
        } else {
            profileResult = existingProfile;
        }

        // Check if user has a subscription
        const { data: existingSub, error: subError } = await adminSupabase
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .single();

        // Create default subscription if it doesn't exist
        if (subError && subError.code === 'PGRST116') {
            console.log(`No subscription found for user ${userId}, creating default...`);

            const { data: newSub, error: createSubError } = await adminSupabase
                .from('user_subscriptions')
                .insert({
                    user_id: userId,
                    plan_id: 'free',
                    status: 'active',
                    next_billing_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            if (createSubError) {
                console.error('Error creating subscription:', createSubError);
                return NextResponse.json({
                    profile: profileResult,
                    subscription_error: createSubError.message
                });
            }

            subscriptionResult = newSub;
        } else if (subError) {
            console.error('Error checking subscription:', subError);
            return NextResponse.json({
                profile: profileResult,
                subscription_error: subError.message
            });
        } else {
            subscriptionResult = existingSub;
        }

        return NextResponse.json({
            success: true,
            profile: profileResult,
            subscription: subscriptionResult
        });
    } catch (error) {
        console.error('Error in ensure-profile:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}