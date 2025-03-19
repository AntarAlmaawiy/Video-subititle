"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";

interface SidebarProps {
    user: {
        name?: string | null;
        email?: string | null;
        image?: string | null;
    };
}

export default function Sidebar({ user }: SidebarProps) {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Check if the viewport is mobile
    useEffect(() => {
        const checkIfMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) {
                setIsCollapsed(true);
            }
        };

        // Initial check
        checkIfMobile();

        // Add event listener
        window.addEventListener('resize', checkIfMobile);

        // Cleanup
        return () => window.removeEventListener('resize', checkIfMobile);
    }, []);

    const navItems = [
        { name: "Dashboard", href: "/dashboard", icon: "🏠" },
        { name: "Subtitle Generator", href: "/dashboard/subtitle-generator", icon: "🎬" },
        { name: "Video Library", href: "/dashboard/video-library", icon: "🎞️" },
        { name: "Storage", href: "/dashboard/storage", icon: "💾" },
        { name: "Manage-plan", href: "/dashboard/manage-plan", icon: "💳" },
    ];

    const toggleSidebar = () => {
        if (!isMobile) {
            setIsCollapsed(!isCollapsed);
        } else {
            setIsMobileMenuOpen(!isMobileMenuOpen);
        }
    };

    const handleSignOut = async () => {
        await signOut({ callbackUrl: "/" });
    };

    // Get user initials for avatar fallback
    const userInitials = user?.name
        ? user.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
        : user?.email?.substring(0, 2).toUpperCase() || "U";

    // Mobile menu button
    const mobileMenuButton = (
        <button
            onClick={toggleSidebar}
            className="fixed z-50 top-4 left-4 bg-indigo-600 text-white p-3 rounded-lg shadow-lg md:hidden"
            aria-label="Toggle menu"
        >
            {isMobileMenuOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
            ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            )}
        </button>
    );

    // Mobile full-screen menu
    const mobileMenu = (
        <div className={`fixed inset-0 bg-indigo-800 z-40 transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:hidden`}>
            <div className="pt-20 pb-20 h-full flex flex-col">
                {/* Logo in mobile menu */}
                <div className="px-6 flex items-center justify-center mb-8">
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-8 h-8 text-indigo-300"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-.55l.025-.027a4.5 4.5 0 001.954-1.423A2.25 2.25 0 0116.5 13.5v-3.75M9 9l0 10.5M9 9c0 .81.355 1.543.92 2.045m0 0A9.001 9.001 0 0010.5 19.5V9"
                        />
                    </svg>
                    <span className="ml-3 text-xl font-semibold text-white">SubTranslate</span>
                </div>

                {/* Navigation items in mobile menu */}
                <nav className="flex-1 overflow-y-auto px-6">
                    <ul className="space-y-4">
                        {navItems.map((item) => (
                            <li key={item.name}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center py-4 px-4 rounded-lg transition-colors ${
                                        pathname === item.href
                                            ? "bg-indigo-600 text-white"
                                            : "text-indigo-100 hover:bg-indigo-700"
                                    }`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    <span className="text-xl mr-3">{item.icon}</span>
                                    <span>{item.name}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>

                {/* User section in mobile menu */}
                <div className="px-6 py-4 border-t border-indigo-700">
                    <div className="flex items-center mb-4">
                        {user?.image ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden">
                                <Image
                                    src={user.image}
                                    alt={user.name || "User"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                <span className="text-sm font-medium">{userInitials}</span>
                            </div>
                        )}
                        <div className="ml-3 overflow-hidden">
                            <p className="text-sm font-medium text-white truncate">
                                {user?.name || user?.email || "User"}
                            </p>
                            {user?.email && user?.name && (
                                <p className="text-xs text-indigo-300 truncate">
                                    {user.email}
                                </p>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={handleSignOut}
                        className="w-full flex items-center justify-center py-3 px-4 bg-indigo-700 text-white rounded-lg hover:bg-indigo-600 transition-colors"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5 mr-2"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                            />
                        </svg>
                        Sign out
                    </button>
                </div>
            </div>
        </div>
    );

    // Desktop sidebar
    const desktopSidebar = (
        <aside
            className={`hidden md:block bg-indigo-800 text-white transition-all duration-300 h-screen ${
                isCollapsed ? "w-20" : "w-64"
            } relative`}
        >
            {/* Toggle button */}
            <button
                onClick={toggleSidebar}
                className="absolute right-0 top-4 translate-x-1/2 bg-indigo-600 rounded-full p-1 shadow-lg"
            >
                {isCollapsed ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                    </svg>
                )}
            </button>

            {/* Logo */}
            <div className="p-6 flex items-center">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-8 h-8 text-indigo-300"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-.55l.025-.027a4.5 4.5 0 001.954-1.423A2.25 2.25 0 0116.5 13.5v-3.75M9 9l0 10.5M9 9c0 .81.355 1.543.92 2.045m0 0A9.001 9.001 0 0010.5 19.5V9"
                    />
                </svg>
                {!isCollapsed && (
                    <span className="ml-3 text-lg font-semibold">SubTranslate</span>
                )}
            </div>

            {/* Navigation */}
            <nav className="mt-8">
                <ul className="space-y-2 px-4">
                    {navItems.map((item) => (
                        <li key={item.name}>
                            <Link
                                href={item.href}
                                className={`flex items-center py-3 px-4 rounded-lg transition-colors ${
                                    pathname === item.href
                                        ? "bg-indigo-600 text-white"
                                        : "text-indigo-100 hover:bg-indigo-600"
                                }`}
                            >
                                <span className="text-xl">{item.icon}</span>
                                {!isCollapsed && <span className="ml-3">{item.name}</span>}
                            </Link>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* User section */}
            <div className="absolute bottom-0 left-0 right-0 p-4">
                <div className="border-t border-indigo-700 pt-4">
                    <div className="flex items-center px-4">
                        {user?.image ? (
                            <div className="relative w-10 h-10 rounded-full overflow-hidden">
                                <Image
                                    src={user.image}
                                    alt={user.name || "User"}
                                    fill
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                                <span className="text-sm font-medium">{userInitials}</span>
                            </div>
                        )}

                        {!isCollapsed && (
                            <div className="ml-3 overflow-hidden">
                                <p className="text-sm font-medium truncate">
                                    {user?.name || user?.email || "User"}
                                </p>
                                {user?.email && user?.name && (
                                    <p className="text-xs text-indigo-300 truncate">
                                        {user.email}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleSignOut}
                        className={`mt-4 flex items-center py-2 px-4 text-indigo-300 hover:text-white rounded-lg transition-colors hover:bg-indigo-700 w-full ${
                            isCollapsed ? "justify-center" : ""
                        }`}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                            />
                        </svg>
                        {!isCollapsed && <span className="ml-2">Sign out</span>}
                    </button>
                </div>
            </div>
        </aside>
    );

    return (
        <>
            {/* Desktop sidebar */}
            {desktopSidebar}

            {/* Mobile menu button */}
            {mobileMenuButton}

            {/* Mobile full-screen menu */}
            {mobileMenu}
        </>
    );
}