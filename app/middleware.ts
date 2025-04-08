// middleware.ts
import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    // Add more debug logging
    console.log("Middleware checking path:", path);

    // Explicitly allow these paths
    if (
        path.startsWith('/api/auth') ||
        path.startsWith('/api/webhook') ||
        path === '/signin' ||
        path === '/signup' ||
        path === '/' ||
        path.includes('.') ||
        path.startsWith('/_next') || // Explicitly allow Next.js resources
        path.startsWith('/public')   // Explicitly allow public files
    ) {
        return NextResponse.next();
    }

    // Protect other routes
    const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET,
    });

    // Add token debug (in development only)
    if (process.env.NODE_ENV === 'development') {
        console.log("Auth token present:", !!token);
    }

    if (!token) {
        const signInUrl = new URL('/signin', request.url);
        // Pass the attempted URL as callback
        signInUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
        console.log("Redirecting to:", signInUrl.toString());
        return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
}

// Configure paths that trigger the middleware
export const config = {
    matcher: [
        // Match all paths except these
        "/((?!_next|api/auth|public|signin|signup|favicon.ico).*)",
        "/dashboard/:path*" // Specifically match dashboard paths
    ],
};