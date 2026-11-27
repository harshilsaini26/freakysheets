import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Everything is pre-rendered from pipeline/data at build time, so the app
  // runs on Vercel's Hobby plan with no database or server-side compute.
  outputFileTracingIncludes: { "/*": ["./pipeline/data/**/*.json"] },
};

export default config;
