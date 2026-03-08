import type { NextConfig } from "next";

/** For GitHub Pages: set NEXT_PUBLIC_BASE_PATH=/circumstances when building for deploy */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const isExportBuild = Boolean(basePath);
// Full URL for assets so fonts, JS, CSS load correctly on GitHub Pages (avoids 404s)
const assetPrefix = basePath
  ? "https://sylathas.github.io/circumstances/"
  : undefined;

const nextConfig: NextConfig = {
  reactStrictMode: false,
  // Only use static export when building for deploy (basePath set). In dev this is off
  // so /project/[id] works without requiring generateStaticParams to succeed on every navigation.
  ...(isExportBuild ? { output: "export" as const } : {}),
  basePath: basePath || undefined,
  assetPrefix,
};

export default nextConfig;
