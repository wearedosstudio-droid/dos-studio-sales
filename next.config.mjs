/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // No usamos ESLint todavía; los errores de TypeScript sí bloquean el build.
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Panel privado: que no lo indexen buscadores ni se pueda incrustar.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
