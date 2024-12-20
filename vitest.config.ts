import { defineConfig } from "vitest/config"

export default defineConfig({
  esbuild: {
    target: "es2020"
  },
  optimizeDeps: {
    // exclude: ["bun:sqlite"]
  },
  test: {
    // setupFiles: [path.join(__dirname, "setupTests.ts")],
    fakeTimers: {
      toFake: undefined
    },
    sequence: {
      concurrent: true
    },
    include: ["test/**/*.test.ts"]
  }
})
