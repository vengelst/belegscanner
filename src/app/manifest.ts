import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BelegBox",
    short_name: "BelegBox",
    description: "Webbasierte Belegverwaltung für Erfassung, Prüfung und Versand.",
    start_url: "/receipts",
    display: "standalone",
    orientation: "portrait-primary",
    theme_color: "#00C9B7",
    background_color: "#F5F5F5",
    icons: [
      {
        src: "/icons/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
