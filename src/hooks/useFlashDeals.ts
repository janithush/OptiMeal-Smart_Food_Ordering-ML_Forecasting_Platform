"use client";

import { useEffect, useState, useCallback } from "react";
import type { FlashDealBannerData } from "@/components/menu/FlashDealBanner";

/**
 * useFlashDeals — Hook for listening to Flash Deal Socket.io events and
 * maintaining active deals state for the Student menu.
 * Handles: initial fetch, flashDealPublished, flashDealCancelled.
 * Story 6.4: Smart Discount Trigger & Flash Deals (FR-25)
 */
export function useFlashDeals() {
  const [deals, setDeals] = useState<FlashDealBannerData[]>([]);

  // ── Initial fetch + Socket.io listener ────────────────────────
  useEffect(() => {
    let socket: ReturnType<typeof import("socket.io-client").io> | null = null;

    const connect = async () => {
      // Fetch initial deals
      try {
        const res = await fetch("/api/student/flash-deals");
        if (res.ok) {
          const data = await res.json();
          setDeals(data.deals);
        }
      } catch {
        /* ignore */
      }

      // WebSocket listener
      const { io } = await import("socket.io-client");
      socket = io("/student", {
        path: "/socket.io",
        withCredentials: true,
        transports: ["websocket", "polling"],
      });

      socket.on("flashDealPublished", (payload: FlashDealBannerData) => {
        setDeals((prev) => {
          // Avoid duplicates
          if (prev.some((d) => d.id === payload.id)) return prev;
          return [payload, ...prev];
        });
      });

      socket.on("flashDealCancelled", (payload: { flashDealId: string }) => {
        setDeals((prev) => prev.filter((d) => d.id !== payload.flashDealId));
      });
    };

    connect();

    return () => {
      socket?.disconnect();
    };
  }, []);

  // Remove an expired deal from local state
  const removeDeal = useCallback((dealId: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== dealId));
  }, []);

  return { deals, removeDeal };
}
