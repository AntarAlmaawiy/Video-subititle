// app/signup
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { signUpWithEmail } from "@/lib/supabase";
import { supabase } from "@/lib/supabase";

export default function SignUpPage() {
    const router = useRouter();
    const [formData, setFormData] = useState({
        email: "",
        password: "",
        username: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            // Validate form data
            if (!formData.username || !formData.email || !formData.password) {
                throw new Error("All fields are required");
            }

            if (formData.password.length < 6) {
                throw new Error("Password must be at least 6 characters");
            }

            console.log("Starting sign up process with:", {
                email: formData.email,
                username: formData.username,
                passwordLength: formData.password.length
            });

            // Register the user in Supabase
            try {
                const signUpResult = await signUpWithEmail(
                    formData.email,
                    formData.password,
                    formData.username
                );

                console.log("Sign up successful:", signUpResult);
                setSuccess("Account created successfully!");

                // Try to sign in automatically
                try {
                    const result = await signIn("credentials", {
                        redirect: false,
                        email: formData.email,
                        password: formData.password,
                    });

                    console.log("Sign in result:", result);

                    if (result?.error) {
                        setSuccess("Account created! Please sign in manually.");
                        setTimeout(() => {
                            router.push("/signin");
                        }, 2000);
                    } else {
                        // Successful sign-in
                        router.push("/subtitle-generator");
                    }
                } catch (signInError) {
                    console.error("Error during automatic sign in:", signInError);
                    setSuccess("Account created! Please sign in manually.");
                    setTimeout(() => {
                        router.push("/signin");
                    }, 2000);
                }
            } catch (signUpError: any) {
                console.error("Supabase signup error:", signUpError);
                throw new Error(signUpError.message || "Error creating account");
            }

        } catch (error: any) {
            console.error("Sign up error:", error);
            setError(error.message || "An error occurred during sign up");
        } finally {
            setLoading(false);
        }
    };

    // Debug function to test Supabase connection
    const testSupabaseConnection = async () => {
        try {
            console.log("Testing Supabase connection...");
            const { data, error } = await supabase.auth.getSession();
            console.log("Supabase connection test:", { data, error });
            alert("Supabase connection test complete. Check console for details.");
        } catch (e) {
            console.error("Supabase connection error:", e);
            alert("Error testing Supabase connection. Check console for details.");
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <Link href="/">
                        <Image
                            src="/logo.svg"
                            alt="SubTranslate Logo"
                            width={60}
                            height={60}
                            className="h-12 w-auto"
                        />
                    </Link>
                    <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
                        Create your account
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Start generating subtitles in minutes
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="username" className="sr-only">
                                Username
                            </label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                autoComplete="username"
                                required
                                className="relative block w-full rounded-md border-0 p-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                                placeholder="Username"
                                value={formData.username}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="email" className="sr-only">
                                Email address
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="relative block w-full rounded-md border-0 p-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                                placeholder="Email address"
                                value={formData.email}
                                onChange={handleInputChange}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                minLength={6}
                                className="relative block w-full rounded-md border-0 p-2.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm"
                                placeholder="Password (min. 6 characters)"
                                value={formData.password}
                                onChange={handleInputChange}
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="text-red-500 text-sm text-center">{error}</div>
                    )}

                    {success && (
                        <div className="text-green-500 text-sm text-center">{success}</div>
                    )}

                    <div>
                        <button
                            type="submit"
                            className="group relative flex w-full justify-center rounded-md bg-indigo-600 py-2.5 px-3 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                            disabled={loading}
                        >
                            {loading ? "Creating account..." : "Sign up"}
                        </button>
                    </div>
                </form>

                {/* Debug button */}
                <div className="text-center">
                    <button
                        type="button"
                        onClick={testSupabaseConnection}
                        className="text-xs text-gray-500 underline"
                    >
                        Test Supabase Connection
                    </button>
                </div>

                <div className="text-center mt-4">
                    <p className="text-sm text-gray-600">
                        Already have an account?{" "}
                        <Link href="/signin" className="font-medium text-indigo-600 hover:text-indigo-500">
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}