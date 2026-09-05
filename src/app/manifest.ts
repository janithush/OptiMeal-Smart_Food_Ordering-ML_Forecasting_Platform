import type { MetadataRoute } from "next";

/**
 * Web App Manifest — served at /manifest.webmanifest.
 * Icons are generated from public/icons/icon.svg (see raster procedure
 * in PWA setup); 512px entry doubles as the maskable icon (glyph kept
 * inside the central 80% safe zone).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CaféSmart — University Canteen",
    short_name: "CaféSmart",
    description:
      "Smart University Canteen — pre-order meals, top up your wallet, skip the queue.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#171208",
    theme_color: "#171208",
    categories: ["food", "lifestyle"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
