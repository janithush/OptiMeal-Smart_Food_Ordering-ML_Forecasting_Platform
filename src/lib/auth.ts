import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { PrismaAdapter } from "@auth/prisma-adapter"
import { prisma } from "./prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
      authorization: {
        params: {
          scope: "openid email profile",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async signIn({ user }) {
      // Any valid Google account can sign in — no domain restriction (AD-4 revised)
      // Fail-closed: block deactivated accounts instantly.
      if (user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { isActive: true },
        });
        // Existing user explicitly deactivated → deny sign-in.
        // New user (no row yet, adapter creates it) → allow.
        if (dbUser && dbUser.isActive === false) return false;
      }
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // On first sign-in: PrismaAdapter creates the User record
      if (user) {
        const dbRole =
          (user as { role?: string }).role ??
          (
            await prisma.user.findUnique({
              where: { id: user.id },
              select: { role: true, isActive: true },
            })
          )?.role ??
          "STUDENT";
        // Fail-closed: unknown roles fall back to minimum privilege.
        token.role = dbRole === "ADMIN" ? "ADMIN" : "STUDENT";
        token.id = user.id!;
      }
      // Refresh profile picture and name from Google on each sign-in
      if (account?.provider === "google" && profile) {
        const googleProfile = profile as { picture?: string; name?: string };
        if (token.email) {
          await prisma.user.update({
            where: { email: token.email },
            data: {
              image: googleProfile.picture ?? undefined,
              name: googleProfile.name ?? undefined,
            },
          });
        }
      }
      // Refresh role from database on subsequent requests
      // Fail-closed: deactivated users lose privileges immediately.
      if (!user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { role: true, id: true, isActive: true },
        });
        if (!dbUser || dbUser.isActive === false) {
          token.role = "STUDENT";
          // Keep id so session can be identified, but strip admin rights.
          if (dbUser) token.id = dbUser.id;
          return token;
        }
        token.role = dbUser.role === "ADMIN" ? "ADMIN" : "STUDENT";
        token.id = dbUser.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const role = token.role === "ADMIN" ? "ADMIN" : "STUDENT";
        session.user.role = role;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
})
