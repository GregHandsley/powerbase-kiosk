import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// You can read from package.json or a manual string
import pkg from "./package.json";

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
});
