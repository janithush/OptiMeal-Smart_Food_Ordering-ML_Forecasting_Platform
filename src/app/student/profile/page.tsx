import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SignOutButton from "./SignOutButton";
import ProfileFormClient from "./ProfileFormClient";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.role !== "STUDENT") redirect("/forbidden");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true, name: true, email: true, image: true,
      regNo: true, batch: true, department: true,
      dietaryPreference: true, allergies: true, phone: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-[oklch(0.08_0.01_260)] py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[oklch(0.97_0_0)]">Your Profile</h1>
            <p className="mt-1 text-[oklch(0.65_0.01_260)] text-sm">{user.email}</p>
          </div>
          <SignOutButton />
        </div>

        {/* Form Card */}
        <div className="rounded-2xl p-6 md:p-8" style={{ background: "rgba(255,255,255,0.04)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <ProfileFormClient user={user} />
        </div>
      </div>
    </div>
  );
}
