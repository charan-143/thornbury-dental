import { execSync } from "child_process";

process.env.ANALYZE = "true";

try {
  execSync("npx next build", {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ANALYZE: "true" },
  });
} catch (error) {
  process.exit(error.status ?? 1);
}
