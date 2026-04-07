import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "::1"],
  async redirects() {
    return [
      // Preserve legacy Jobs links while Visits remains the canonical workspace.
      {
        destination: "/dashboard/visits",
        permanent: false,
        source: "/dashboard/jobs"
      },
      {
        destination: "/dashboard/visits/:path*",
        permanent: false,
        source: "/dashboard/jobs/:path*"
      },
      {
        destination: "/dashboard/finance",
        permanent: false,
        source: "/dashboard/invoices"
      },
      {
        destination: "/dashboard/supply/:path*",
        permanent: false,
        source: "/dashboard/parts/:path*"
      },
      {
        destination: "/dashboard/supply",
        permanent: false,
        source: "/dashboard/parts"
      },
      {
        destination: "/dashboard/supply/inventory/:path*",
        permanent: false,
        source: "/dashboard/inventory/:path*"
      },
      {
        destination: "/dashboard/supply/inventory",
        permanent: false,
        source: "/dashboard/inventory"
      }
    ];
  },
  transpilePackages: [
    "@mobile-mechanic/api-client",
    "@mobile-mechanic/core",
    "@mobile-mechanic/types",
    "@mobile-mechanic/validation"
  ]
};

export default nextConfig;
