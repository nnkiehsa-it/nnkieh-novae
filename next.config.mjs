import withSerwistInit from "@serwist/next";

const appVersion =
  process.env.NEXT_PUBLIC_APP_VERSION ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.npm_package_version ||
  "development";

const publicEnvironment = {
  NEXT_PUBLIC_ALLOWED_DOMAIN: process.env.NEXT_PUBLIC_ALLOWED_DOMAIN || "",
  NEXT_PUBLIC_LOCAL_DEV_AUTH: process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH || "false",
  NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL:
    process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL || "admin@integration.invalid",
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  NEXT_PUBLIC_APP_VERSION: appVersion,
  NEXT_PUBLIC_FIREBASE_API_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED:
    process.env.NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED || "false",
  NEXT_PUBLIC_FIREBASE_APP_ID:
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL || "",
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID:
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  NEXT_PUBLIC_FIREBASE_VAPID_KEY:
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
  NEXT_PUBLIC_GOOGLE_CLIENT_ID:
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY:
    process.env.NEXT_PUBLIC_RECAPTCHA_ENTERPRISE_SITE_KEY || "",
  NEXT_PUBLIC_SCHOOL_NAME: process.env.NEXT_PUBLIC_SCHOOL_NAME || "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
};

const withSerwist = withSerwistInit({
  disable: process.env.NODE_ENV === "development",
  register: true,
  swDest: "public/sw.js",
  swSrc: "src/app/sw.ts",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  distDir: process.env.NOVAE_NEXT_DIST_DIR || ".next",
  env: publicEnvironment,
  experimental: {
    staleTimes: {
      dynamic: 300,
      static: 1800,
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.googleusercontent.com" },
    ],
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
        ],
      },
      {
        source: "/version.json",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default withSerwist(nextConfig);
