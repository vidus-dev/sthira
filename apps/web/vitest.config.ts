import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mirrors the path aliases in vite.config.ts so component imports resolve in tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // The mobile workspace uses React 19 and npm hoists it to the repo root; make every
    // package in this app resolve the web app's own React 18.
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@lib": path.resolve(__dirname, "./src/lib"),
      "@features": path.resolve(__dirname, "./src/features"),
      "@app": path.resolve(__dirname, "./src/app"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    // Let Vite (and resolve.dedupe) handle Radix so it renders with this app's React.
    server: { deps: { inline: [/@radix-ui\//] } },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // E2E specs live under e2e/ and run via Playwright, not Vitest.
    exclude: ["node_modules", "dist", "e2e"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/components/common/**", "src/components/ui/button.tsx"],
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/lib/api/schema.d.ts"],
    },
  },
});
