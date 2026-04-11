import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const apiProxy = process.env.API_PROXY_TARGET || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  trailingSlash: true,
  output: isGithubActions ? 'export' : undefined,
  basePath: isGithubActions ? '/UniversityTeachingAssistent' : '',
  assetPrefix: isGithubActions ? '/UniversityTeachingAssistent/' : '',
  images: {
    unoptimized: isGithubActions,
  },
  ...(isGithubActions ? {} : {
    async rewrites() {
      return [
        {
          source: "/auth/:path*",
          destination: `${apiProxy}/auth/:path*`,
        },
        {
          source: "/courses/:path*",
          destination: `${apiProxy}/courses/:path*`,
        },
        {
          source: "/courses",
          destination: `${apiProxy}/courses`,
        },
        {
          source: "/assignments/:path*",
          destination: `${apiProxy}/assignments/:path*`,
        },
        {
          source: "/assignments",
          destination: `${apiProxy}/assignments`,
        },
        {
          source: "/students/status",
          destination: `${apiProxy}/students/status`,
        },
        {
          source: "/rag/:path*",
          destination: `${apiProxy}/rag/:path*`,
        },
        {
          source: "/grading/:path*",
          destination: `${apiProxy}/grading/:path*`,
        },
        {
          source: "/graph/:path*",
          destination: `${apiProxy}/graph/:path*`,
        },
        {
          source: "/integrity/:path*",
          destination: `${apiProxy}/integrity/:path*`,
        },
        {
          source: "/webhooks/:path*",
          destination: `${apiProxy}/webhooks/:path*`,
        },
        {
          source: "/health",
          destination: `${apiProxy}/health`,
        },
      ];
    },
  }),
};

export default nextConfig;