import type { MetadataRoute } from "next";
import { APP_SHORT_NAME, SITE_DESCRIPTION, TOURNAMENT_SHORT_NAME } from "@/lib/brand";

// "Add to Home screen" icon and colours.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: TOURNAMENT_SHORT_NAME,
    short_name: APP_SHORT_NAME,
    description: SITE_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f7",
    theme_color: "#135463",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
