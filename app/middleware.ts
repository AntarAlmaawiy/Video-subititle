import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
    publicRoutes: ["/", "/signin", "/signup"]
});

export const config = {
    matcher: ["/((?!_next|.*\\..*|api).*)", "/"],
};