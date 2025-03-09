// app/dashboard/layout.tsx
import { auth } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
                                                  children,
                                              }: {
    children: React.ReactNode;
}) {
    const session = await auth();

    // Check if user is authenticated
    if (!session || !session.user) {
        redirect("/signin");
    }

    return (
        <div className="flex h-screen bg-gray-50">
            <Sidebar user={session.user} />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
    );
}