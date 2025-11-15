/** @type {import('next').NextConfig} */
const nextConfig = {
  // Ensure puppeteer-core and @sparticuz/chromium are treated as external for server components
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium", "@sparticuz/chromium-min"],
  // Optimize chunk loading to prevent ChunkLoadError
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Avoid bundling puppeteer-core and chromium to prevent ESM private field parse errors in SWC
      config.externals = config.externals || [];
      config.externals.push("puppeteer-core", "@sparticuz/chromium", "@sparticuz/chromium-min");
      // Prevent bundling exifr on server to avoid UMD dynamic require warnings
      config.externals.push("exifr");
    }

    // Optimize chunk splitting for better loading performance
    if (!isServer) {
      // Increase chunk load timeout to reduce ChunkLoadError on slow networks/devices
      config.output = {
        ...config.output,
        chunkLoadTimeout: 300000, // 5 minutes
      };
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks?.cacheGroups,
            // Create separate chunk for InformationSections component
            informationSections: {
              test: /[\\/]components[\\/]InformationSections\.tsx/,
              name: 'information-sections',
              priority: 10,
              reuseExistingChunk: true,
            },
            // Vendor chunk for large dependencies
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendor',
              priority: 5,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }

    // Suppress the critical dependency warning from libheif-js (HEIC image conversion library)
    // and exifr UMD build when accidentally picked up by SSR
    // This is a known issue with these libs using dynamic require() that Next.js can't statically analyze
    config.ignoreWarnings = [
      {
        module: /libheif-bundle\.js/,
        message: /Critical dependency: require function is used in a way in which dependencies cannot be statically extracted/,
      },
      {
        module: /node_modules[\\/]+exifr[\\/]+dist[\\/]+full\.umd\.js/,
        message: /Critical dependency: the request of a dependency is an expression/,
      },
    ];

    return config;
  },
};

export default nextConfig;
