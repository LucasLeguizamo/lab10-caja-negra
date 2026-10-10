import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cualquier ruta debe responder como el original; Next no puede redirigir por su cuenta.
  skipTrailingSlashRedirect: true,
  poweredByHeader: false,
};

export default nextConfig;
