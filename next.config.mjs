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
    ],
  },
};

export default nextConfig;

