// Builds the shell and the sandbox origin the way .github/workflows/deploy.yml does, but with
// both pointed at localhost, then prints the two supervised wrangler commands that serve them.
// The origins are baked into each build (the sandbox CSP's frame-ancestors, the shell's
// VITE_SANDBOX_URL), so a plain `pnpm build` or a turbo floor run that rebuilds apps/web without
// them leaves every game showing "Games can't run on this setup". Re-run this after any such run.
//
// Game bundles must already exist: run `pnpm build` in each sibling game repo first.
import { spawnSync } from "node:child_process";

const SHELL = "http://localhost:8788";
const SANDBOX = "http://localhost:8789";

function run(label, filter, env) {
  console.log(`\n[local-production] ${label}`);
  const res = spawnSync("pnpm", ["--filter", filter, "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (res.status !== 0) {
    console.error(`[local-production] ${label} failed`);
    process.exit(res.status ?? 1);
  }
}

run("sandbox origin", "@hubbub/sandbox-app", { HUBBUB_SHELL_ORIGIN: SHELL, HUBBUB_RELAY_ORIGIN: SHELL });
run("web shell", "@hubbub/web", { VITE_SANDBOX_URL: SANDBOX });

console.log(`
[local-production] built. Serve the pair (sv.ps1 is the supervised-run skill's script):

  sv.ps1 ensure -Project hubbub -Cmd "pnpm --filter @hubbub/worker exec wrangler dev --port 8788" -NoDynamicPort
  sv.ps1 ensure -Project hubbub -Cmd "pnpm --filter @hubbub/worker exec wrangler dev -c ../sandbox/wrangler.jsonc --port 8789" -NoDynamicPort

Then drive ${SHELL} with the capture skill (--base-url ${SHELL}).`);
