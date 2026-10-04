import { defineConfig } from "vite";

// Relative base so the built game works from any URL path,
// e.g. when embedded in the portfolio via an iframe.
export default defineConfig({
  base: "./",
});
