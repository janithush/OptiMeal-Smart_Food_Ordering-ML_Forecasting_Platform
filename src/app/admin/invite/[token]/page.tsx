import { requireAuth } from "@/lib/auth-helpers";
import InviteAcceptClient from "./InviteAcceptClient";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const session = await requireAuth();
  const { token } = await params;

  return (
    <InviteAcceptClient
      token={token}
      userEmail={session.user?.email ?? ""}
      userName={session.user?.name ?? "User"}
    />
  );
}