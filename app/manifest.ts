import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Retrace",
    short_name: "Retrace",
    description: "Replay autopsy and informatics for osu!standard.",
    start_url: "/",
    display: "standalone",
    background_color: "#1a1216",
    theme_color: "#231b20",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
