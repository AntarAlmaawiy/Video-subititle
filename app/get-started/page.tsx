// app/get-started/page.tsx
'use client';

import { useUser } from '@clerk/nextjs';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Loading from '@/app/Loading';

export default function GetStarted() {
    const { isLoaded, isSignedIn } = useUser();
    const router = useRouter();

    useEffect(() => {
        if (isLoaded) {
            if (isSignedIn) {
                router.push('/subtitle-generator');
            } else {
                router.push('/signin');
            }
        }
    }, [isLoaded, isSignedIn, router]);

    return <Loading />;
}