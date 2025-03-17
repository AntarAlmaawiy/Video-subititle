"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, User, LogOut } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import { usePathname } from "next/navigation";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const { data: session, status } = useSession();
    const isAuthenticated = status === "authenticated";
    const pathname = usePathname();

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

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

                            {!isAuthenticated ? (
                                <>
                                    <Link href="/get-started" className="text-gray-700 hover:text-gray-900">Get Started</Link>
                                    <Link href="/#pricing" className="text-gray-700 hover:text-gray-900">Pricing</Link>                                </>
                            ) : (
                                <>
                                    <Link href="/manage-plan" className="text-gray-700 hover:text-gray-900">Manage Plan</Link>
                                    <Link href="/dashboard" className="text-gray-700 hover:text-gray-900">Dashboard</Link>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Right Side - Authentication Buttons */}
                    <div className="hidden md:flex items-center space-x-4">
                        {!isAuthenticated ? (
                            <>
                                <Link href="/signup">
                                    <button className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md">
                                        Sign Up
                                    </button>
                                </Link>
                                <Link href="/signin">
                                    <button className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-600 hover:bg-indigo-600 hover:text-white rounded-md">
                                        Log In
                                    </button>
                                </Link>
                            </>
                        ) : (
                            <div className="relative">
                                <button
                                    className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
                                    onClick={toggleDropdown}
                                >
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                        {session?.user?.image ? (
                                            <Image
                                                src={session.user.image}
                                                alt="User Avatar"
                                                width={32}
                                                height={32}
                                                className="rounded-full"
                                            />
                                        ) : (
                                            <User className="h-5 w-5 text-indigo-600" />
                                        )}
                                    </div>
                                    <span className="font-medium">{session?.user?.name || 'User'}</span>
                                </button>

                                {/* Dropdown Menu - Now using click toggle instead of hover */}
                                {isDropdownOpen && (
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                                        <button
                                            onClick={() => signOut({ callbackUrl: '/' })}
                                            className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                            <div className="flex items-center">
                                                <LogOut className="h-4 w-4 mr-2" />
                                                Sign out
                                            </div>
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden">
                        <button
                            onClick={toggleMenu}
                            className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none"
                        >
                            <span className="sr-only">Open main menu</span>
                            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu */}
            {isMenuOpen && (
                <div className="md:hidden">
                    <div className="pt-2 pb-3 space-y-1 px-2">
                        <Link
                            href="/#features"
                            className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                            onClick={toggleMenu}
                        >
                            Features
                        </Link>
                        {!isAuthenticated ? (
                            <>
                                <Link
                                    href="/get-started"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={toggleMenu}
                                >
                                    Get Started
                                </Link>
                                <Link
                                    href="/#pricing"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        toggleMenu();
                                        document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
                                    }}
                                >
                                    Pricing
                                </Link>
                            </>
                        ) : (
                            <>
                                <Link
                                    href="/manage-plan"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={toggleMenu}
                                >
                                    Manage Plan
                                </Link>
                                <Link
                                    href="/dashboard"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={toggleMenu}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    href="/subtitle-generator"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                    onClick={toggleMenu}
                                >
                                    Subtitle Generator
                                </Link>
                                <button
                                    onClick={() => signOut({ callbackUrl: '/' })}
                                    className="w-full text-left block px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50"
                                >
                                    <div className="flex items-center">
                                        <LogOut className="h-4 w-4 mr-2" />
                                        Sign out
                                    </div>
                                </button>
                            </>
                        )}
                    </div>

                    {/* Authentication links for mobile */}
                    {!isAuthenticated && (
                        <div className="pt-4 pb-3 border-t border-gray-200">
                            <div className="mt-3 space-y-1 px-2">
                                <Link
                                    href="/signin"
                                    className="block px-3 py-2 rounded-md text-base font-medium text-indigo-600 hover:bg-gray-50"
                                    onClick={toggleMenu}
                                >
                                    Sign in
                                </Link>
                                <Link
                                    href="/signup"
                                    className="block px-3 py-2 rounded-md text-base font-medium bg-indigo-600 text-white hover:bg-indigo-700"
                                    onClick={toggleMenu}
                                >
                                    Sign up
                                </Link>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </nav>
    );
};

export default Navbar;