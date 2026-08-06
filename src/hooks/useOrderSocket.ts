"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { io, Socket } from "socket.io-client";
import type { OrderStatusPayload } from "@/lib/order-events";

let globalSocket: Socket | null = null;

export function useOrderSocket() {
  const { data: session } = useSession();
  const [lastUpdate, setLastUpdate] = useState<OrderStatusPayload | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const handlerRef = useRef<((p: OrderStatusPayload) => void) | null>(null);

  useEffect(() => {
    if (!session?.user) return;

    if (!globalSocket) {
      globalSocket = io("/student", {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });

      globalSocket.on("connect", () => setIsConnected(true));
      globalSocket.on("disconnect", () => setIsConnected(false));
    }

    const socket = globalSocket!;

    const handleUpdate = (payload: OrderStatusPayload) => {
      setLastUpdate(payload);
      handlerRef.current?.(payload);
    };

    socket.on("orderStatusChanged", handleUpdate);

    return () => {
      socket.off("orderStatusChanged", handleUpdate);
      handlerRef.current = null;
    };
  }, [session]);

  const onUpdate = useCallback((handler: (p: OrderStatusPayload) => void) => {
    handlerRef.current = handler;
  }, []);

  return { lastUpdate, isConnected, onUpdate };
}
