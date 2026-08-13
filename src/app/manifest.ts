import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "development";
  return {
    background_color: "#fdfdfd",
    description: "Novae",
    display: "standalone",
    icons: [
      { src: `/pwa-64x64.png?v=${version}`, sizes: "64x64", type: "image/png" },
      {
        src: `/pwa-192x192.png?v=${version}`,
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: `/pwa-512x512.png?v=${version}`,
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: `/maskable-icon-512x512.png?v=${version}`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    name: "Novae",
    orientation: "any",
    scope: "/",
    short_name: "Novae",
    start_url: "/",
    theme_color: "#fdfdfd",
  };
}
