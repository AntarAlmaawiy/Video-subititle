// app/signup/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
    return (
        <div className="flex justify-center items-center min-h-screen">
            <SignUp redirectUrl="/subtitle-generator" />
        </div>
    );
}