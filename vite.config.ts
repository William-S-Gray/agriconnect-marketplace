import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Rewrites %OG_BASE% in index.html.
 *
 * Social crawlers want an absolute og:image URL, but the production domain is
 * only known at deploy time. Set VITE_SITE_URL (e.g. https://agriconnect.co.zw)
 * and the tags become absolute; leave it unset and they fall back to a
 * root-relative path, which still works locally and in most crawlers.
 *
 * The value is read via loadEnv rather than process.env, so it can be set in a
 * .env file as well as the shell: process.env is not populated from .env files
 * inside vite.config.
 */
function ogBase(siteUrl: string | undefined): Plugin {
  const base = (siteUrl ?? "").trim().replace(/\/+$/, "");
  return {
    name: "agriconnect-og-base",
    transformIndexHtml: (html) => html.replaceAll("%OG_BASE%", base),
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Merges .env / .env.[mode] files with matching shell variables.
  const env = loadEnv(mode, process.cwd());

  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      ogBase(env.VITE_SITE_URL),
      mode === "development" && componentTagger(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
