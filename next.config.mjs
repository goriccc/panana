/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
let supabaseHostname = "";
try {
  if (supabaseUrl) supabaseHostname = new URL(supabaseUrl).hostname;
} catch {}

const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https",
              hostname: supabaseHostname,
              pathname: "/**",
            },
          ]
        : []),
      { protocol: "https", hostname: "fal.media", pathname: "/**" },
      { protocol: "https", hostname: "v3.fal.media", pathname: "/**" },
      { protocol: "https", hostname: "v3b.fal.media", pathname: "/**" },
    ],
  },
};

export default nextConfig;

