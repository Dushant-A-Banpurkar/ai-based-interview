import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    coverage: {
      provider: "v8", // Native V8 coverage engine (fastest)
      reporter: ["text", "json", "html"], // 'text' prints in terminal, 'html' outputs web report
      include: ["src/**/*.ts"],
      exclude: [
        "src/**/*.test.ts",
        "src/types/**/*.ts",
        "src/server.ts", // Exclude entrypoint listeners
        "**/node_modules/**",
      ],
      // Enforce minimum percentage thresholds for test runs to pass
      thresholds: {
        perFile: true,
        lines: 85,
        functions: 85,
      },
    },
  },
});
