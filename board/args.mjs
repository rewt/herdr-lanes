import { resolve } from "node:path";

export function repoRootFromArgs(args, cwd = process.cwd()) {
  const repoIndex = args.indexOf("--repo");
  if (repoIndex >= 0 && (args[repoIndex + 1] === undefined || args[repoIndex + 1].startsWith("--"))) {
    throw new Error("--repo requires a path");
  }
  return resolve(repoIndex >= 0 ? args[repoIndex + 1] : cwd);
}
