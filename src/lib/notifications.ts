/**
 * Show a browser push notification. Only fires when the tab is NOT focused.
 * Falls back silently if permission is denied or unavailable.
 */
export function showNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (document.visibilityState === "visible") return; // don't notify when focused

  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission === "default") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") new Notification(title, { body, icon: "/favicon.ico" });
    });
  }
}
