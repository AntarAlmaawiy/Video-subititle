// app/dashboard/page.tsx
import { auth } from "@/app/api/auth/[...nextauth]/route";
import {redirect} from "next/navigation";

export default async function DashboardPage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/signing');

    }

    return (

        <div className="space-y-6">
            <div className="bg-white p-8 rounded-lg shadow">
                <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard</h1>
                <p className="text-gray-600">
                    Welcome back, {session?.user?.name || "User"}! This is your personal dashboard.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <DashboardCard
                    title="Subtitle Generator"
                    description="Create and edit subtitles for your videos"
                    link="/dashboard/subtitle-generator"
                />
                <DashboardCard
                    title="Storage"
                    description="Manage your videos and subtitle files"
                    link="/dashboard/storage"
                />
                <DashboardCard
                    title="Recent Activity"
                    description="View your recent subtitled videos"
                    link="/dashboard/video-library"
                />
            </div>
        </div>
    );
}

function DashboardCard({ title, description, link }: { title: string; description: string; link: string }) {
    return (
        <a
            href={link}
            className="block bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow duration-300"
        >

            <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-gray-600">{description}</p>
        </a>
    );
}