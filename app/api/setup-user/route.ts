// app/api/setup-user/route.ts
import { NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import { ensureUserProfile } from '@/lib/auth-helpers';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id || !session?.user?.email) {
            return NextResponse.json({ error: 'Not authenticated or missing user data' }, { status: 401 });
        }

        const result = await ensureUserProfile(
            session.user.id,
            session.user.email,
            session.user.name || undefined
        );

        return NextResponse.json({
            success: !!result,
            message: result ? 'User setup complete' : 'Failed to setup user'
        });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}