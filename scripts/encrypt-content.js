"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DEFAULT_ITERATIONS = 150000;
const MARKER_RE = /<template\b[^>]*data-hugo-encrypt-start[^>]*>([\s\S]*?)<\/template>([\s\S]*?)<template\b[^>]*data-hugo-encrypt-end[^>]*><\/template>/g;

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    publicDir: "public",
    iterations: DEFAULT_ITERATIONS,
    scriptUrl: "/js/hugo-blog-encrypt.js",
    styleUrl: "/css/hugo-blog-encrypt.css",
    scrubIndex: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      i += 1;
      if (i >= argv.length) throw new Error(`Missing value for ${arg}`);
      return argv[i];
    };

    if (arg === "--root") options.root = next();
    else if (arg === "--public") options.publicDir = next();
    else if (arg === "--iterations") options.iterations = Number(next());
    else if (arg === "--script-url") options.scriptUrl = next();
    else if (arg === "--style-url") options.styleUrl = next();
    else if (arg === "--no-scrub-index") options.scrubIndex = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!Number.isInteger(options.iterations) || options.iterations < 10000) {
    throw new Error("--iterations must be an integer >= 10000");
  }

  options.root = path.resolve(options.root);
  options.publicDir = path.isAbsolute(options.publicDir)
    ? options.publicDir
    : path.resolve(options.root, options.publicDir);
  return options;
}

function printHelp() {
  console.log([
    "Usage:",
    "  hugo && hugo-blog-encrypt",
    "",
    "Options:",
    "  --root <dir>          Hugo project root, default: cwd",
    "  --public <dir>        Public output dir relative to root, default: public",
    "  --iterations <n>      PBKDF2 iterations, default: 150000",
    "  --script-url <url>    Browser decrypt script URL, default: /js/hugo-blog-encrypt.js",
    "  --style-url <url>     CSS URL, default: /css/hugo-blog-encrypt.css",
    "  --no-scrub-index      Do not scrub public/index.json"
  ].join("\n"));
}

function walk(dir, predicate, files = []) {
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const current = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(current, predicate, files);
    else if (!predicate || predicate(current)) files.push(current);
  }
  return files;
}

function ensureDir(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
}

function copyAsset(source, destination) {
  ensureDir(destination);
  fs.copyFileSync(source, destination);
}

function installRuntimeAssets(options) {
  const base = path.resolve(__dirname, "..");
  const scriptTarget = path.join(options.publicDir, options.scriptUrl.replace(/^\/+/, ""));
  const styleTarget = path.join(options.publicDir, options.styleUrl.replace(/^\/+/, ""));
  copyAsset(path.join(base, "static/js/hugo-blog-encrypt.js"), scriptTarget);
  copyAsset(path.join(base, "static/css/hugo-blog-encrypt.css"), styleTarget);
}

function toBase64Url(value) {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encryptHtml(html, password, iterations) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(password, salt, iterations, 32, "sha256");
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(html, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    v: 1,
    iterations,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: Buffer.concat([encrypted, tag]).toString("base64")
  };
}

function makeWidget(payload) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return [
    '<div class="hugo-encrypt-box" data-hugo-encrypt>',
    `<script type="application/json">${json}</script>`,
    "</div>"
  ].join("");
}

function injectAssetTags(html, options) {
  let next = html;
  if (options.styleUrl && !next.includes(options.styleUrl)) {
    next = next.replace(/<\/head>/i, `<link rel="stylesheet" href="${options.styleUrl}">\n</head>`);
  }
  if (options.scriptUrl && !next.includes(options.scriptUrl)) {
    next = next.replace(/<\/body>/i, `<script defer src="${options.scriptUrl}"></script>\n</body>`);
  }
  return next;
}

function encryptFile(file, options) {
  const original = fs.readFileSync(file, "utf8");
  let changed = false;
  const next = original.replace(MARKER_RE, (match, rawConfig, html) => {
    let config;
    try {
      config = JSON.parse(rawConfig);
    } catch (error) {
      throw new Error(`Invalid encrypt marker JSON in ${file}: ${rawConfig}`);
    }

    if (!config.password) throw new Error(`Missing password in encrypt marker in ${file}`);

    const encrypted = encryptHtml(html.trim(), config.password, options.iterations);
    const id = toBase64Url(crypto.createHash("sha256").update(file + "\0" + html).digest()).slice(0, 22);
    changed = true;
    return makeWidget({
      ...encrypted,
      id,
      prompt: config.prompt || "请输入密码"
    });
  });

  if (changed) fs.writeFileSync(file, injectAssetTags(next, options));
  return changed;
}

function contentPathToPermalink(root, file) {
  const relative = path.relative(path.join(root, "content"), file).replace(/\\/g, "/");
  if (relative.startsWith("_") || relative.includes("/_")) return "";

  const withoutExt = relative.replace(/\.(md|markdown|html)$/i, "");
  const parts = withoutExt.split("/");
  if (parts[parts.length - 1] === "index") parts.pop();
  return "/" + parts.join("/") + "/";
}

function readFrontMatter(file) {
  const text = fs.readFileSync(file, "utf8");
  const trimmed = text.trimStart();
  if (trimmed.startsWith("+++")) {
    const end = trimmed.indexOf("\n+++", 3);
    return end === -1 ? "" : trimmed.slice(3, end);
  }
  if (trimmed.startsWith("---")) {
    const end = trimmed.indexOf("\n---", 3);
    return end === -1 ? "" : trimmed.slice(3, end);
  }
  return "";
}

function hasPasswordFrontMatter(frontMatter) {
  return /(^|\n)\s*password\s*[:=]\s*['"][^'"]+['"]/.test(frontMatter);
}

function hasPartialEncryptShortcode(text) {
  return text.includes("{{< encrypt") || text.includes("{{% encrypt");
}

function findProtectedPermalinks(root) {
  const contentDir = path.join(root, "content");
  return new Set(
    walk(contentDir, (file) => /\.(md|markdown|html)$/i.test(file))
      .filter((file) => {
        const text = fs.readFileSync(file, "utf8");
        return hasPasswordFrontMatter(readFrontMatter(file)) || hasPartialEncryptShortcode(text);
      })
      .map((file) => contentPathToPermalink(root, file))
      .filter(Boolean)
  );
}

function scrubSearchIndex(options, protectedPermalinks) {
  const indexFile = path.join(options.publicDir, "index.json");
  if (!options.scrubIndex || !fs.existsSync(indexFile) || protectedPermalinks.size === 0) {
    return false;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(indexFile, "utf8"));
  } catch (error) {
    return false;
  }

  let changed = false;
  for (const item of Array.isArray(data) ? data : []) {
    const url = item.permalink || item.uri || item.url || item.href || "";
    const pathname = url ? new URL(url, "https://example.invalid").pathname : "";
    if (protectedPermalinks.has(pathname)) {
      for (const key of ["content", "summary", "description"]) {
        if (item[key]) {
          item[key] = item.password ? "此文章已加密。" : "此文章包含加密内容。";
          changed = true;
        }
      }
    }
  }

  if (changed) fs.writeFileSync(indexFile, JSON.stringify(data));
  return changed;
}

function run(rawOptions) {
  const options = rawOptions || parseArgs(process.argv.slice(2));
  installRuntimeAssets(options);

  const htmlFiles = walk(options.publicDir, (file) => file.endsWith(".html"));
  const encryptedFiles = htmlFiles.filter((file) => encryptFile(file, options));
  const scrubbed = scrubSearchIndex(options, findProtectedPermalinks(options.root));

  console.log("Installed runtime assets.");
  console.log(`Encrypted ${encryptedFiles.length} HTML file(s).`);
  if (scrubbed) console.log("Scrubbed protected articles from public/index.json.");
}

function main() {
  try {
    run();
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main,
  run,
  parseArgs,
  encryptHtml,
  encryptFile
};

if (require.main === module) {
  main();
}
