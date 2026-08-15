import { readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const environment = option("--environment") || "production";
if (!/^[a-z][a-z0-9-]*$/u.test(environment)) throw new Error("Invalid deployment environment.");
const hyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID?.trim();
if (!/^[a-f0-9]{32}$/u.test(hyperdriveId || "")) {
  throw new Error("CLOUDFLARE_HYPERDRIVE_ID must be a 32-character hexadecimal ID.");
}

const sourcePath = fileURLToPath(new URL("../cloudflare/wrangler.json", import.meta.url));
const outputPath = option("--output") || fileURLToPath(
  new URL("../cloudflare/wrangler.deploy.json", import.meta.url),
);
const config = JSON.parse(await readFile(sourcePath, "utf8"));
const sourceDirectory = dirname(sourcePath);
const outputDirectory = dirname(outputPath);
const rebasePath = (value) => {
  const target = resolve(sourceDirectory, value);
  const rebased = relative(outputDirectory, target);
  if (isAbsolute(rebased)) return target.replaceAll("\\", "/");
  const portable = rebased.replaceAll("\\", "/");
  return portable.startsWith(".") ? portable : `./${portable}`;
};
config.main = rebasePath(config.main);
if (typeof config.$schema === "string") config.$schema = rebasePath(config.$schema);
const production = environment === "production";
const workerName = process.env.CLOUDFLARE_WORKER_NAME?.trim()
  || (production ? "novae-api" : `novae-api-${environment}`);
const queueName = process.env.CLOUDFLARE_QUEUE_NAME?.trim()
  || (production ? "novae-jobs" : `novae-jobs-${environment}`);

config.name = workerName;
config.vars.NOTION_ENABLED = process.env.NOTION_ENABLED === "true" ? "true" : "false";
config.hyperdrive[0].id = hyperdriveId;
delete config.hyperdrive[0].localConnectionString;
config.queues.producers[0].queue = queueName;
config.queues.consumers[0].queue = queueName;
const namespaceOffset = production ? 1000 : 2000;
config.ratelimits = config.ratelimits.map((binding, index) => ({
  ...binding,
  namespace_id: String(namespaceOffset + index + 1),
}));
await writeFile(outputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ environment, outputPath, queueName, workerName }));
