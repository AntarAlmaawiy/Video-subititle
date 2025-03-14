// middleware.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Explicitly allow these paths
    if (
        path.startsWith('/api/auth') ||
        path.startsWith('/api/webhook') ||
        path === '/signin' ||
        path === '/signup' ||
        path === '/' ||
        path.includes('.')
    ) {
        return NextResponse.next();
    }

    // Protect other routes
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    if (!token) {
        return NextResponse.redirect(new URL('/signin', request.url));
    }

    return NextResponse.next();
}

// Configure paths that trigger the middleware
export const config = {
    matcher: ["/((?!_next|api/auth|public).*)", "/"],
};