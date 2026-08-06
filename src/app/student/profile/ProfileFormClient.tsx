"use client";

import { useRouter } from "next/navigation";
import ProfileForm from "@/components/profile/ProfileForm";
import type { ProfileData } from "@/components/profile/ProfileForm";

type UserProfile = {
  id: string; name: string; email: string; image: string | null;
  regNo: string | null; batch: string | null; department: string | null;
  dietaryPreference: string | null; allergies: string[]; phone: string | null;
};

export default function ProfileFormClient({ user }: { user: UserProfile }) {
  const router = useRouter();

  const handleSubmit = async (data: ProfileData) => {
    const res = await fetch("/api/student/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) return { error: result.error ?? "Failed to save" };
    router.refresh();
  };

  return (
    <ProfileForm
      isOnboarding={false}
      initialData={{
        name: user.name,
        image: user.image ?? "",
        regNo: user.regNo ?? "",
        batch: user.batch ?? "",
        department: user.department ?? "",
        dietaryPreference: user.dietaryPreference ?? "",
        allergies: user.allergies,
        phone: user.phone ?? "",
      }}
      onSubmit={handleSubmit}
    />
  );
}
