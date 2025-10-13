/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure puppeteer-core and @sparticuz/chromium are treated as external for server components
  experimental: {
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "@sparticuz/chromium-min"],
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Avoid bundling puppeteer-core and chromium to prevent ESM private field parse errors in SWC
      config.externals = config.externals || [];
      config.externals.push("puppeteer-core", "@sparticuz/chromium", "@sparticuz/chromium-min");
    }

    // Suppress the critical dependency warning from libheif-js (HEIC image conversion library)
    // This is a known issue with libheif-js using dynamic require() that Next.js can't statically analyze
    config.ignoreWarnings = [
      {
        module: /libheif-bundle\.js/,
        message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      },
    ];

    return config;
  },
};

export default nextConfig;
