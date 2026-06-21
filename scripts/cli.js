"use strict";

const { spawnSync } = require("child_process");
const path = require("path");
const encrypt = require("./encrypt-content");
const { servePublic } = require("./serve-public");

function printHelp() {
  console.log([
    "Usage:",
    "  hugo-blog-encrypt [encrypt] [options]",
    "  hugo-blog-encrypt build [options]",
    "  hugo-blog-encrypt preview [options]",
    "  hugo-blog-encrypt serve [options]",
    "",
    "Commands:",
    "  encrypt   Encrypt an existing Hugo public directory. Default command.",
    "  build     Run Hugo, then encrypt public output.",
    "  preview   Run build, then serve public output locally.",
    "  serve     Serve public output without rebuilding.",
    "",
    "Common options:",
    "  --root <dir>       Hugo project root, default: cwd",
    "  --public <dir>     Public output dir relative to root, default: public",
    "  --hugo <bin>       Hugo binary, default: HUGO env or hugo",
    "  --host <host>      Preview host, default: 127.0.0.1",
    "  --port <port>      Preview port, default: 1313",
    "  --baseURL <url>    Hugo baseURL, default: http://<host>:<port>/",
    "  --no-minify        Do not pass --minify to Hugo",
    "  --no-clean         Do not pass --cleanDestinationDir to Hugo",
    "",
    "Encryption options:",
    "  --iterations <n>   PBKDF2 iterations, default: 150000",
    "  --no-scrub-index   Do not scrub public/index.json"
  ].join("\n"));
}

function resolveFromRoot(root, target) {
  return path.isAbsolute(target) ? target : path.resolve(root, target);
}

function parseCliArgs(argv) {
  let command = argv[0] || "encrypt";
  let args = argv.slice(1);
  if (command.startsWith("-")) {
    command = "encrypt";
    args = argv;
  }
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    process.exit(0);
  }

  const options = {
    command,
    root: process.cwd(),
    publicDir: "public",
    hugo: process.env.HUGO || "hugo",
    host: process.env.HOST || "127.0.0.1",
    port: process.env.PORT || "1313",
    baseURL: "",
    minify: true,
    clean: true,
    encryptArgs: []
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    const next = () => {
      i += 1;
      if (i >= args.length) throw new Error(`Missing value for ${arg}`);
      return args[i];
    };

    if (arg === "--root") options.root = next();
    else if (arg === "--public") {
      const value = next();
      options.publicDir = value;
      options.encryptArgs.push("--public", value);
    } else if (arg === "--hugo") options.hugo = next();
    else if (arg === "--host") options.host = next();
    else if (arg === "--port") options.port = next();
    else if (arg === "--baseURL") options.baseURL = next();
    else if (arg === "--no-minify") options.minify = false;
    else if (arg === "--no-clean") options.clean = false;
    else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      options.encryptArgs.push(arg);
    }
  }

  options.root = path.resolve(options.root);
  options.publicDir = resolveFromRoot(options.root, options.publicDir);
  if (!options.baseURL) options.baseURL = `http://${options.host}:${options.port}/`;
  options.encryptArgs.unshift("--root", options.root);
  return options;
}

function runCommand(bin, args, root) {
  const result = spawnSync(bin, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32"
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

function buildHugo(options) {
  const args = [];
  if (options.minify) args.push("--minify");
  if (options.clean) args.push("--cleanDestinationDir");
  args.push("--baseURL", options.baseURL);
  runCommand(options.hugo, args, options.root);
}

function runEncrypt(options) {
  encrypt.run(encrypt.parseArgs(options.encryptArgs));
}

function main() {
  try {
    const options = parseCliArgs(process.argv.slice(2));
    if (options.command === "encrypt") {
      runEncrypt(options);
    } else if (options.command === "build") {
      buildHugo(options);
      runEncrypt(options);
    } else if (options.command === "preview") {
      buildHugo(options);
      runEncrypt(options);
      servePublic({ root: options.root, publicDir: options.publicDir, host: options.host, port: options.port });
    } else if (options.command === "serve") {
      servePublic({ root: options.root, publicDir: options.publicDir, host: options.host, port: options.port });
    } else {
      throw new Error(`Unknown command: ${options.command}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = {
  main,
  parseCliArgs
};

if (require.main === module) {
  main();
}
