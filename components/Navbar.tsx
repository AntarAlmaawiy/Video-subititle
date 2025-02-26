"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X } from "lucide-react";
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    return (
        <nav className="bg-white shadow-sm fixed w-full z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">

                    {/* Left Side - Logo */}
                    <div className="flex items-center space-x-8">
                        <Link href="/" className="flex-shrink-0 flex items-center">
                            <Image
                                src="/logo.svg"
                                alt="SubTranslate Logo"
                                width={40}
                                height={40}
                                className="h-8 w-auto"
                            />
                            <span className="ml-2 text-xl font-bold text-gray-900">SubTranslate</span>
                        </Link>

                        {/* Links (Visible to Everyone) */}
                        <div className="hidden md:flex space-x-6">
                            <Link href="/#features" className="text-gray-700 hover:text-gray-900" scroll={true}>
                                Features
                            </Link>

                            <Link href="/get-started" className="text-gray-700 hover:text-gray-900">Get Started</Link>

                            {/* Show Pricing for Logged-Out Users & Manage Plan for Logged-In Users */}
                            <SignedOut>
                                <Link href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>
                            </SignedOut>
                            <SignedIn>
                                <Link href="/manage-plan" className="text-gray-700 hover:text-gray-900">Manage Plan</Link>
                            </SignedIn>
                        </div>
                    </div>

                    {/* Right Side - Authentication Buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        <SignedOut>
                            <SignUpButton mode="modal">
                                <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">
                                    Sign Up
                                </button>
                            </SignUpButton>
                            <SignInButton mode="modal">
                                <button className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white rounded-md">
                                    Log In
                                </button>
                            </SignInButton>
                        </SignedOut>

                        <SignedIn>
                            <UserButton />
                        </SignedIn>
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
