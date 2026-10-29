// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
// @ts-expect-error plain JS helper script
import { buildMainTxt } from "./scripts/main-txt.mjs";

// Keeps public/main.txt in sync with every source file on start, build and each file change.
const mainTxtPlugin = {
  name: "fms-main-txt",
  buildStart() {
    buildMainTxt();
  },
  configureServer(server: { watcher: { on: (e: string, cb: (f: string) => void) => void } }) {
    let t: ReturnType<typeof setTimeout> | undefined;
    server.watcher.on("all", (file: string) => {
      if (file.endsWith("main.txt")) return;
      clearTimeout(t);
      t = setTimeout(() => buildMainTxt(), 300);
    });
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mainTxtPlugin],
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:3001",
          changeOrigin: true,
        },
      },
    },
  },
});