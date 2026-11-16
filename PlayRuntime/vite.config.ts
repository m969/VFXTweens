import { defineConfig, type Plugin } from "vite";

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

function reloadAfterEffectExport(): Plugin {
  return {
    name: "vfx-effect-export-reload",
    configureServer(server) {
      const effectPaths = [
        "catalog.json",
        "impact-ring.vfx.json",
        "impact-layered.vfx.json",
        "skill-wave-pulse.vfx.json",
        "skill-slash-arc.vfx.json",
        "skill-light-arc-slash.vfx.json",
        "skill-slash-sweep-left-to-right.vfx.json",
        "projectile-fireball.vfx.json",
        "projectile-arcane-bolt.vfx.json",
        "projectile-grenade.vfx.json",
        "projectile-three-lane.vfx.json",
        "projectile-six-lane.vfx.json"
      ].map((fileName) => `${server.config.root}/public/effects/${fileName}`);
      server.watcher.add(effectPaths);
      const watchedPaths = new Set(effectPaths.map(normalizePath));

      server.watcher.on("change", (changedPath) => {
        if (watchedPaths.has(normalizePath(changedPath))) {
          server.ws.send({ type: "full-reload", path: "*" });
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [reloadAfterEffectExport()]
});
