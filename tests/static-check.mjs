import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const release = "20260921-1";
const releaseRoot = join(root, "releases", release);

async function read(path) {
  return readFile(join(root, path), "utf8");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else files.push(path);
  }
  return files;
}

const [html, css, serviceWorker, manifestText, gitignore] = await Promise.all([
  read("index.html"),
  read(`releases/${release}/styles.css`),
  read("service-worker.js"),
  read(`releases/${release}/manifest.webmanifest`),
  read(".gitignore")
]);
const manifest = JSON.parse(manifestText);
const sourceFiles = (await walk(root)).filter((path) => !path.includes(`${join(root, ".git")}`));
const textExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".webmanifest", ".md", ".gitignore"]);
const textFiles = [];
for (const path of sourceFiles) {
  const extension = path.endsWith(".gitignore") ? ".gitignore" : path.slice(path.lastIndexOf("."));
  if (textExtensions.has(extension)) {
    textFiles.push([relative(root, path), await readFile(path, "utf8")]);
  }
}
const combinedText = textFiles.map(([, contents]) => contents).join("\n");
const appJavaScript = textFiles
  .filter(([path]) => path.replaceAll("\\", "/").startsWith(`releases/${release}/js/`))
  .map(([, contents]) => contents)
  .join("\n");

assert.match(html, new RegExp(`data-app-release="${release}"`));
assert.match(html, new RegExp(`releases/${release}/styles\\.css`));
assert.match(html, new RegExp(`releases/${release}/js/app\\.js`));
assert.match(html, /apple-touch-icon/);
assert.doesNotMatch(html, /<script\b[^>]*\bsrc=["']https?:/i);
assert.doesNotMatch(html, /<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']https?:/i);
assert.match(html, /viewport-fit=cover/);

assert.match(css, /min-height:\s*44px/);
assert.match(css, /overflow-x:\s*hidden/);
assert.match(css, /safe-area-inset-(top|right|bottom|left)/);
assert.match(css, /aspect-ratio:\s*16\s*\/\s*9/);
assert.match(css, /overflow-wrap:\s*anywhere/);
assert.match(css, /:focus-visible/);

assert.equal(manifest.start_url, "../../index.html");
assert.equal(manifest.scope, "../../");
assert.equal(manifest.id, "../../");
assert.equal(manifest.display, "standalone");
assert.equal(manifest.icons.length >= 2, true);
for (const icon of manifest.icons) {
  assert.match(icon.src, /^\.\//);
  await access(join(releaseRoot, icon.src));
}

assert.match(serviceWorker, new RegExp(`APP_RELEASE = "${release}"`));
assert.match(serviceWorker, /STAGING_CACHE_NAME/);
assert.match(serviceWorker, /await verifyCurrentShell\(\)/);
assert.match(serviceWorker, /controller|clients\.claim/);
assert.doesNotMatch(serviceWorker, /googleapis\.com|ytimg\.com|API_KEY_STORAGE_KEY/);
const shellBlock = serviceWorker.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] ?? "";
const shellPaths = [...shellBlock.matchAll(/"(\.\/[^\"]+)"/g)].map((match) => match[1]);
assert.equal(shellPaths.length > 0, true);
for (const path of shellPaths) {
  await access(join(root, path));
}

assert.doesNotMatch(appJavaScript, /\.innerHTML\b/);
assert.doesNotMatch(appJavaScript, /console\.(log|debug|info|warn|error)\s*\(/);
assert.doesNotMatch(combinedText, /AIza[0-9A-Za-z_-]{30,}/);
assert.doesNotMatch(appJavaScript, /[?&]key=/);
assert.match(appJavaScript, /X-Goog-Api-Key/);
assert.match(appJavaScript, /globalThis\.fetch\.bind\(globalThis\)|scope\.fetch\.bind\(scope\)/);
assert.match(appJavaScript, /noopener noreferrer external/);

for (const expected of [".env", "*.log", "node_modules/", ".cache/", "local-data/"]) {
  assert.equal(gitignore.includes(expected), true, `.gitignore is missing ${expected}`);
}

assert.doesNotMatch(combinedText, /youtube\.com\/watch\?v=[0-9A-Za-z_-]{11}(?:\b|$)/i);

process.stdout.write(`STATIC_CHECK_PASS files=${textFiles.length} shell=${shellPaths.length}\n`);
