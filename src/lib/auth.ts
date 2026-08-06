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
    async signIn() {
      // Any valid Google account can sign in — no domain restriction (AD-4 revised)
      return true;
    },
    async jwt({ token, user, account, profile }) {
      // On first sign-in: PrismaAdapter creates the User record
      if (user) {
        token.role = (user as { role?: string }).role ?? "STUDENT";
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
      if (!user && token.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { role: true, id: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.id = dbUser.id;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
})
