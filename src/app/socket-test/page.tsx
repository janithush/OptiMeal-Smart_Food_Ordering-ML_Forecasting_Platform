"use client";

/**
 * Temporary Socket.io connectivity test page.
 * Verifies the /student namespace is reachable.
 *
 * AD-1: This is a Client Component ("use client") because it uses
 * browser-side Socket.io. All other pages default to Server Components.
 *
 * This page can be removed after Story 2.1 is implemented.
 */

import { useEffect, useState } from "react";
import { io as socketIO } from "socket.io-client";

type ConnectionStatus = "Connecting..." | "Connected ✅" | "Disconnected ❌" | "Error ❌";

export default function SocketTestPage() {
  const [studentStatus, setStudentStatus] = useState<ConnectionStatus>("Connecting...");
  const [adminStatus, setAdminStatus] = useState<ConnectionStatus>("Connecting...");
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLogs((prev) => [`${new Date().toISOString()} — ${msg}`, ...prev]);

  useEffect(() => {
    // Test /student namespace
    const studentSocket = socketIO("/student", { transports: ["websocket"] });
    studentSocket.on("connect", () => {
      setStudentStatus("Connected ✅");
      addLog("Connected to /student namespace");
      // Trigger the ping handler to test round-trip
      studentSocket.emit("ping");
    });
    studentSocket.on("orderStatusChanged", (data) => {
      addLog(`/student received: ${JSON.stringify(data)}`);
    });
    studentSocket.on("disconnect", () => {
      setStudentStatus("Disconnected ❌");
      addLog("Disconnected from /student");
    });
    studentSocket.on("connect_error", (err) => {
      setStudentStatus("Error ❌");
      addLog(`/student error: ${err.message}`);
    });

    // Test /admin namespace
    const adminSocket = socketIO("/admin", { transports: ["websocket"] });
    adminSocket.on("connect", () => {
      setAdminStatus("Connected ✅");
      addLog("Connected to /admin namespace");
    });
    adminSocket.on("disconnect", () => {
      setAdminStatus("Disconnected ❌");
      addLog("Disconnected from /admin");
    });
    adminSocket.on("connect_error", (err) => {
      setAdminStatus("Error ❌");
      addLog(`/admin error: ${err.message}`);
    });

    return () => {
      studentSocket.disconnect();
      adminSocket.disconnect();
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8 font-mono">
      <h1 className="text-2xl font-bold mb-6">
        🔌 Socket.io Connectivity Test
      </h1>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Namespace: /student</p>
          <p className="text-xl font-semibold">{studentStatus}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-4">
          <p className="text-gray-400 text-sm mb-1">Namespace: /admin</p>
          <p className="text-xl font-semibold">{adminStatus}</p>
        </div>
      </div>
      <div className="bg-gray-900 rounded-lg p-4">
        <p className="text-gray-400 text-sm mb-3">Event Log</p>
        {logs.length === 0 ? (
          <p className="text-gray-600">Waiting for events...</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {logs.map((log, i) => (
              <li key={i} className="text-green-400">{log}</li>
            ))}
          </ul>
        )}
      </div>
      <p className="mt-8 text-gray-600 text-xs">
        This page is a temporary dev tool and will be removed after Story 2.1.
      </p>
    </main>
  );
}
