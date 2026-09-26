import { defineConfig } from "vite";

export default defineConfig({
  // Project Pages serves this build at /novae/. Local dev keeps /.
  base: process.env.GITHUB_PAGES_BASE || "/",
});
