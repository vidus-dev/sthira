import path from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Mirrors the path aliases in vite.config.ts so component imports resolve in tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
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
