"use client";

import { motion } from "motion/react";
import { Crown, User } from "lucide-react";
import type { GroupParticipantData } from "@/types/group-order";
import { springSnappy } from "@/lib/motion";

const COLORS = [
  "bg-purple-500", "bg-blue-500", "bg-emerald-500",
  "bg-amber-500", "bg-rose-500", "bg-cyan-500",
];

interface Props {
  participants: GroupParticipantData[];
  organizerId: string;
  maxSlots?: number;
}

export default function GroupOrderParticipants({ participants, organizerId, maxSlots = 6 }: Props) {
  const filled = participants.length;
  const empty = maxSlots - filled;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {participants.map((p, i) => (
        <motion.div
          key={p.studentId}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={springSnappy}
          className="relative"
          title={p.studentName + (p.studentId === organizerId ? " (Organiser)" : "")}
        >
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${COLORS[i % COLORS.length]}`}
          >
            {p.studentName.charAt(0).toUpperCase()}
          </div>
          {p.studentId === organizerId && (
            <Crown className="w-3 h-3 text-yellow-400 absolute -top-1 -right-1 drop-shadow" />
          )}
        </motion.div>
      ))}
      {empty > 0 && (
        <div className="w-8 h-8 rounded-full border border-dashed border-[var(--border-strong)] flex items-center justify-center">
          <User className="w-3.5 h-3.5 text-[var(--text-disabled)]" />
        </div>
      )}
      <span className="text-[10px] text-[var(--text-disabled)] ml-1">{filled}/{maxSlots}</span>
    </div>
  );
}
