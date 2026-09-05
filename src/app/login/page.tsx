"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { motion } from "motion/react";
import { Coffee } from "lucide-react";
import { springSnappy, springGentle, fadeEase } from "@/lib/motion";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status } = useSession();
  const [isLoading, setIsLoading] = useState(false);

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";


  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleSignIn = async () => {
    setIsLoading(true);
    await signIn("google", { callbackUrl });
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] flex flex-col items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ y: springGentle, opacity: fadeEase }}
        className="w-full max-w-md"
      >
        {/* Branding */}
        <div className="text-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...springSnappy, delay: 0.1 }}
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-[var(--brand)]/10 border border-[var(--brand)]/20 mb-6"
          >
            <Coffee className="w-10 h-10 text-[var(--brand)]" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springSnappy, delay: 0.18 }}
            className="text-3xl font-bold text-[var(--text-primary)] tracking-tight"
          >
            CaféSmart
          </motion.h1>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...fadeEase, delay: 0.28 }}
          >
            <p className="mt-2 text-[var(--text-secondary)] text-sm">
              Smart University Canteen System
            </p>
            <p className="mt-1 text-[var(--text-muted)] text-xs">
              Faculty of Technology, University of Ruhuna
            </p>
          </motion.div>
        </div>

        {/* Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSnappy, delay: 0.34 }}
          className="rounded-2xl p-8"
          style={{
            background: "var(--glass-bg)",
            backdropFilter: "var(--glass-blur)",
            border: "1px solid var(--glass-border)",
          }}
        >
          {/* Google Sign-In Button */}
          <motion.button
            onClick={handleSignIn}
            disabled={isLoading}
            whileTap={isLoading ? undefined : { scale: 0.96 }}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                       bg-white text-gray-900 font-medium text-sm
                       hover:bg-gray-100
                       disabled:opacity-60 disabled:cursor-not-allowed
                       transition-colors"
          >
            {isLoading ? (
              <span className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
            )}
            {isLoading ? "Signing in..." : "Sign in with Google"}
          </motion.button>

          <p className="mt-5 text-center text-[var(--text-muted)] text-xs">
            Sign in with your Google account to continue
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center"><div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>}>
      <LoginForm />
    </Suspense>
  );
}
