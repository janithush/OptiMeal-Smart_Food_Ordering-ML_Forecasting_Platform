"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ShieldOff } from "lucide-react";
import { motion } from "motion/react";

export default function ForbiddenPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleGoHome = () => {
    if (!session?.user) {
      router.push("/login");
    } else if (session.user.role === "ADMIN") {
      router.push("/admin/dashboard");
    } else {
      router.push("/student/home");
    }
  };

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="text-center max-w-md"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 mb-6">
          <ShieldOff className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-[oklch(0.97_0_0)]">
          Access Denied
        </h1>
        <p className="mt-2 text-[oklch(0.65_0.01_260)] text-sm">
          You don&apos;t have permission to access this page.
        </p>
        {session?.user && (
          <p className="mt-1 text-[oklch(0.55_0.01_260)] text-xs">
            Signed in as <span className="text-[oklch(0.65_0.01_260)]">{session.user.email}</span>{" "}
            ({session.user.role})
          </p>
        )}
        <button
          onClick={handleGoHome}
          className="mt-8 px-6 py-2.5 rounded-xl bg-[oklch(0.78_0.18_55)] text-black font-medium text-sm
                     hover:bg-[oklch(0.82_0.18_55)] active:scale-[0.98] transition-all duration-200"
        >
          Go to Home
        </button>
      </motion.div>
    </div>
  );
}
