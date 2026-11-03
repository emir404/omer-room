import { defineConfig } from "@playwright/test";

/**
 * Deterministic WebGL in headless Chromium: SwiftShader (software). Chrome 139+ no longer falls
 * back to software WebGL on its own, hence --enable-unsafe-swiftshader.
 * For GPU fidelity checks run with PW_GPU=1 (Metal via ANGLE).
 */
const GL_ARGS = process.env.PW_GPU
  ? ["--use-angle=metal", "--ignore-gpu-blocklist"]
  : ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"];

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "tests",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  workers: 2,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    launchOptions: { args: GL_ARGS },
  },
  webServer: {
    command: `pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
    {
      name: "mobile",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    },
  ],
});
