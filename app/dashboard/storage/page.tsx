"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { getUserStorageStats, getUserSubscription } from "@/lib/supabase"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts"
import Link from "next/link"
import { Crown, Upload } from "lucide-react"

interface StorageStats {
    totalSize: number
    videoCount: number
    usedStorage: number
    maxStorage: number
    formatBreakdown: {
        name: string
        value: number
        count: number
    }[]
}

interface UserSubscription {
    plan_id: string
    status: string
    next_billing_date: string
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"]

export default function StorageDashboard() {
    const { data: session } = useSession()
    const [stats, setStats] = useState<StorageStats | null>(null)
    const [subscription, setSubscription] = useState<UserSubscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchStorageStats = async () => {
            if (!session?.user?.id) return

            try {
                setLoading(true)

                // Get user's subscription first
                const userSubscription = await getUserSubscription(session.user.id)
                setSubscription(userSubscription)

                // Then get storage stats (which will use the correct plan limits)
                const storageStats = await getUserStorageStats(session.user.id)
                setStats(storageStats)
            } catch (err: any) {
                console.error("Error fetching storage stats:", err)
                setError(err.message || "Failed to load storage statistics")
            } finally {
                setLoading(false)
            }
        }

        fetchStorageStats()
    }, [session?.user?.id])

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        )
    }

    if (error) {
        return <div className="bg-red-50 p-4 rounded-md mb-4 text-red-500">{error}</div>
    }

    if (!stats) {
        return (
            <div className="text-center py-10">
                <p className="text-gray-500 mb-4">No storage data available.</p>
            </div>
        )
    }

    const storageUsedPercent = Math.round((stats.usedStorage / stats.maxStorage) * 100)
    const formatBytes = (bytes: number) => {
        if (bytes === 0) return "0 Bytes"
        const k = 1024
        const sizes = ["Bytes", "KB", "MB", "GB"]
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    }

    const isStorageAlmostFull = storageUsedPercent > 80

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold mb-6">Storage Dashboard</h1>

            {/* Current Plan Banner */}
            {subscription && (
                <div
                    className={`mb-8 p-4 rounded-lg ${
                        subscription.plan_id === "free"
                            ? "bg-gray-100"
                            : subscription.plan_id === "pro"
                                ? "bg-blue-50"
                                : "bg-purple-50"
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            {subscription.plan_id === "free" ? (
                                <Upload className="h-6 w-6 mr-3 text-gray-600" />
                            ) : (
                                <Crown className="h-6 w-6 mr-3 text-blue-600" />
                            )}
                            <div>
                                <h3 className="font-medium">
                                    {subscription.plan_id.charAt(0).toUpperCase() + subscription.plan_id.slice(1)} Plan
                                </h3>
                                <p className="text-sm text-gray-600">Next billing date: {subscription.next_billing_date}</p>
                            </div>
                        </div>

                        {subscription.plan_id === "free" && (
                            <Link
                                href="/dashboard/manage-plan"
                                className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded-md transition-colors"
                            >
                                Upgrade Plan
                            </Link>
                        )}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* Storage Usage Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Storage Usage</CardTitle>
                        <CardDescription>Your current storage usage</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-sm font-medium">{formatBytes(stats.usedStorage)} used</span>
                                <span className="text-sm text-gray-500">{formatBytes(stats.maxStorage)} total</span>
                            </div>
                            <Progress value={storageUsedPercent} className={isStorageAlmostFull ? "bg-red-100" : "bg-blue-100"} />
                            <p className={`text-sm pt-2 ${isStorageAlmostFull ? "text-red-500 font-medium" : "text-gray-500"}`}>
                                {storageUsedPercent}% of your storage used
                                {isStorageAlmostFull && subscription?.plan_id === "free" && (
                                    <span className="block mt-1">Consider upgrading your plan for more storage</span>
                                )}
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Video Count Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Video Count</CardTitle>
                        <CardDescription>Total videos in your library</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <div className="text-center">
                            <span className="text-5xl font-bold">{stats.videoCount}</span>
                            <p className="text-sm text-gray-500 mt-2">Videos</p>
                        </div>
                    </CardContent>
                </Card>

                {/* Average Size Card */}
                <Card>
                    <CardHeader>
                        <CardTitle>Average Size</CardTitle>
                        <CardDescription>Average size per video</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center">
                        <div className="text-center">
              <span className="text-3xl font-bold">
                {stats.videoCount > 0 ? formatBytes(stats.totalSize / stats.videoCount) : "0 MB"}
              </span>
                            <p className="text-sm text-gray-500 mt-2">per video</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Format Distribution Chart */}
            <Card className="mb-8">
                <CardHeader>
                    <CardTitle>Storage by Format</CardTitle>
                    <CardDescription>Distribution of storage usage by video format</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-80">
                        {stats.formatBreakdown.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.formatBreakdown}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={120}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {stats.formatBreakdown.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => formatBytes(Number(value))}
                                        labelFormatter={(index) => stats.formatBreakdown[index]?.name || "Unknown"}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="flex items-center justify-center h-full">
                                <p className="text-gray-500">No data available for format breakdown</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Storage Tips */}
            <Card>
                <CardHeader>
                    <CardTitle>Storage Tips</CardTitle>
                    <CardDescription>Maximize your storage space</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="list-disc list-inside space-y-2 text-sm">
                        <li>Delete unused videos to free up space</li>
                        <li>For longer videos, consider reducing the resolution</li>
                        <li>Downloaded videos can be removed from your library but kept locally</li>
                        <li>Storage limits are based on your account plan</li>
                        {subscription?.plan_id === "free" && (
                            <li className="text-blue-600">
                                <Link href="/dashboard/manage-plan" className="hover:underline">
                                    Upgrade to Pro or Elite for more storage space
                                </Link>
                            </li>
                        )}
                    </ul>
                </CardContent>
            </Card>
        </div>
    )
}

