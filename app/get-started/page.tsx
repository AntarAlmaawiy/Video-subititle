// app/get-started/page.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/app/Loading';

export default function GetStarted() {
    const { data: session, status } = useSession();
    const isLoaded = status !== 'loading';
    const isSignedIn = status === 'authenticated';
    const router = useRouter();

    useEffect(() => {
        if (isLoaded) {
            if (isSignedIn) {
                router.push('/subtitle-generator');
            } else {
                router.push('/signin?callbackUrl=/subtitle-generator');
            }
        }
    }, [isLoaded, isSignedIn, router]);

    return <Loading />;
}