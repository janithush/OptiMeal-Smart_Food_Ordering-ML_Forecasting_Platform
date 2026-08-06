"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ClipboardCheck } from "lucide-react";
import ProfileForm from "@/components/profile/ProfileForm";
import type { ProfileData } from "@/components/profile/ProfileForm";

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[oklch(0.08_0.01_260)] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[oklch(0.78_0.18_55)] border-t-transparent rounded-full animate-spin" />
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
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] py-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[oklch(0.78_0.18_55)]/10 border border-[oklch(0.78_0.18_55)]/20 mb-4">
            <ClipboardCheck className="w-7 h-7 text-[oklch(0.78_0.18_55)]" />
          </div>
          <h1 className="text-2xl font-bold text-[oklch(0.97_0_0)]">Complete Your Profile</h1>
          <p className="mt-2 text-[oklch(0.65_0.01_260)] text-sm">Tell us about yourself so we can personalise your experience</p>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-6 md:p-8" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)" }}>
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
