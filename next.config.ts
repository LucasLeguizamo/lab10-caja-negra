import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cualquier ruta debe responder como el original; Next no puede redirigir por su cuenta.
  skipTrailingSlashRedirect: true,
  // proxy.ts necesita ver la URL tal como llega para reproducir los 404 de "//" y /_next.
  skipProxyUrlNormalize: true,
  poweredByHeader: false,
};

export default nextConfig;
