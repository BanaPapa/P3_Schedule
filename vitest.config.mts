import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/features/**/{schemas,format,params,calc,describe}.ts", "src/features/travel/*.ts"],
      exclude: ["src/lib/supabase/**", "src/lib/logger.ts", "src/lib/request-date.ts", "**/*.test.ts", "**/queries.ts", "**/actions.ts"],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
