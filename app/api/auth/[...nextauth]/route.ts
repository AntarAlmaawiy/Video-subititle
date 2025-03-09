// app/api/auth/[...nextauth]/route.ts
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

export const { handlers: { GET, POST }, auth, signIn, signOut } = NextAuth({
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID || "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
        }),
        GitHubProvider({
            clientId: process.env.GITHUB_CLIENT_ID || "",
            clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
        }),
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                try {
                    console.log("NextAuth authorize function called with email:", credentials?.email);

                    if (!credentials?.email || !credentials?.password) {
                        console.log("Missing credentials");
                        return null;
                    }

                    // Use Supabase for authentication
                    const { data, error } = await supabase.auth.signInWithPassword({
                        email: String(credentials.email),
                        password: String(credentials.password),
                    });

                    console.log("Supabase auth result:", { user: data?.user ? "exists" : "null", error: error?.message });

                    if (error || !data.user) {
                        console.log("Auth failed:", error?.message);
                        return null;
                    }

                    // Return user data in the format NextAuth expects
                    const user = {
                        id: data.user.id,
                        email: data.user.email,
                        name: data.user.user_metadata?.username || data.user.email,
                    };

                    console.log("Auth successful, returning user:", user);
                    return user;
                } catch (error) {
                    console.error("Exception in NextAuth authorize:", error);
                    return null;
                }
            },
        }),
    ],
    pages: {
        signIn: "/signin",
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
            }
            return session;
        },
    },
    debug: true, // Enable debug mode
    secret: process.env.NEXTAUTH_SECRET,
});