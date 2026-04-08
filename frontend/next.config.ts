import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';

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
          destination: "http://127.0.0.1:8000/auth/:path*",
        },
        {
          source: "/courses/:path*",
          destination: "http://127.0.0.1:8000/courses/:path*",
        },
        {
          source: "/courses",
          destination: "http://127.0.0.1:8000/courses",
        },
        {
          source: "/assignments/:path*",
          destination: "http://127.0.0.1:8000/assignments/:path*",
        },
        {
          source: "/assignments",
          destination: "http://127.0.0.1:8000/assignments",
        },
        {
          source: "/students/status",
          destination: "http://127.0.0.1:8000/students/status",
        },
        {
          source: "/rag/:path*",
          destination: "http://127.0.0.1:8000/rag/:path*",
        },
        {
          source: "/grading/:path*",
          destination: "http://127.0.0.1:8000/grading/:path*",
        },
        {
          source: "/graph/:path*",
          destination: "http://127.0.0.1:8000/graph/:path*",
        },
        {
          source: "/integrity/:path*",
          destination: "http://127.0.0.1:8000/integrity/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;