import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Talkingston",
    short_name: "Talkingston",
    description: "A thoughtful companion for your everyday life.",
    start_url: "/home",
    scope: "/",
    display: "standalone",
    orientation: "any",
    theme_color: "#0d1b3e",
    background_color: "#090a0f",
    icons: [
      { src: "/talkingston-icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
      { src: "/talkingston-icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
      { src: "/talkingston-icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
