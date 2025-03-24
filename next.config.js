/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import analyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = analyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import("next").NextConfig} */
const config = {
  transpilePackages: ["three"],
  typescript: {
    ignoreBuildErrors: true,
  },

  reactStrictMode: true,
  images: {
    remotePatterns: [
      { hostname: "bandcoin-object-store.s3.amazonaws.com" },
      { hostname: "gateway.pinata.cloud" },
      {
        hostname: "utfs.io",
      },
      { hostname: "app.wadzzo.com" },
      {
        hostname: "firebasestorage.googleapis.com",
      },
      { hostname: "raw.githubusercontent.com" },
      { hostname: "avatars.githubusercontent.com" },
      { hostname: "ipfs.io" },
      { hostname: "daisyui.com" },
      { hostname: "picsum.photos" },
      { hostname: `${process.env.NEXT_AWS_BUCKET_NAME}.s3.amazonaws.com` },
      {
        hostname: `${process.env.NEXT_AWS_BUCKET_NAME}.s3.us-east-1.amazonaws.com`,
      },
    ],
  },

  async rewrites() {
    return [
      {
        source: "/.well-known/stellar.toml",
        destination: "/api/toml",
        // persistance: true
      },
    ];
  },

 

  /**
   * If you are using `appDir` then you must comment the below `i18n` config out.
   *
   * @see https://github.com/vercel/next.js/issues/41980
   */
  i18n: {
    locales: ["en"],
    defaultLocale: "en",
  },
};

export default withBundleAnalyzer(config);
