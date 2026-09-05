"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ClipboardCheck } from "lucide-react";
import ProfileForm from "@/components/profile/ProfileForm";
import type { ProfileData } from "@/components/profile/ProfileForm";
import { springSnappy, springGentle, fadeEase } from "@/lib/motion";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session?.user) {
    router.push("/login");
    return null;
  }

  const handleSubmit = async (data: ProfileData & { onboardingDone?: boolean }) => {
    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, onboardingDone: true }),
    });
    const result = await res.json();
    if (!res.ok) {
      return { error: result.error ?? "Failed to save" };
    }
    router.push("/student/home");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] py-10 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ y: springGentle, opacity: fadeEase }}
        className="max-w-lg mx-auto"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={springSnappy}
            className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[var(--brand)]/10 border border-[var(--brand)]/20 mb-4"
          >
            <ClipboardCheck className="w-7 h-7 text-[var(--brand)]" />
          </motion.div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Complete Your Profile</h1>
          <p className="mt-2 text-[var(--text-secondary)] text-sm">Tell us about yourself so we can personalise your experience</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-6 md:p-8" style={{ background: "var(--glass-bg)", backdropFilter: "var(--glass-blur)", border: "1px solid var(--glass-border)" }}>
          <ProfileForm
            isOnboarding
            initialData={{
              name: session.user.name ?? "",
              image: session.user.image ?? "",
              regNo: "",
              batch: "",
              department: "",
              dietaryPreference: "",
              allergies: [],
              phone: "",
            }}
            onSubmit={handleSubmit}
          />
        </div>
      </motion.div>
    </div>
  );
}
