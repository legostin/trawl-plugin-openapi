import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// One IIFE bundle; React + JSX runtime come from the host globals (externalized),
// so the plugin shares the host's single React instance.
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: "src/plugin.tsx",
      name: "TrawlOpenApiPlugin",
      formats: ["iife"],
      fileName: () => "plugin.js",
    },
    rollupOptions: {
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "ReactJSXRuntime",
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
