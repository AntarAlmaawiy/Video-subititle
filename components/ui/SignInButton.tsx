"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";

export default function SignInButton() {
    return (
        <Button
            onClick={() => signIn("google")}
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-gray-300 hover:bg-gray-100"
        >
            <FcGoogle size={20} />
            Sign in with Google
        </Button>
    );
}
