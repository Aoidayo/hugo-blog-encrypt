"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { run } = require("../scripts/encrypt-content");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "hugo-blog-encrypt-"));
fs.mkdirSync(path.join(root, "public/post"), { recursive: true });
fs.mkdirSync(path.join(root, "content/post"), { recursive: true });

fs.writeFileSync(path.join(root, "content/post/index.md"), [
  "+++",
  'title = "Post"',
  "+++",
  "",
  '{{< encrypt password="secret" >}}hidden{{< /encrypt >}}'
].join("\n"));

fs.writeFileSync(path.join(root, "public/post/index.html"), [
  "<html><head></head><body>",
  '<template data-hugo-encrypt-start>{"password":"secret","prompt":"Password"}</template>',
  "<p>hidden</p>",
  "<template data-hugo-encrypt-end></template>",
  "</body></html>"
].join(""));

fs.writeFileSync(path.join(root, "public/index.json"), JSON.stringify([
  { permalink: "/post/", title: "Post", content: "hidden", summary: "hidden" }
]));

run({
  root,
  publicDir: path.join(root, "public"),
  iterations: 10000,
  scriptUrl: "/js/hugo-blog-encrypt.js",
  styleUrl: "/css/hugo-blog-encrypt.css",
  scrubIndex: true
});

const html = fs.readFileSync(path.join(root, "public/post/index.html"), "utf8");
assert(html.includes("hugo-encrypt-box"));
assert(!html.includes("<p>hidden</p>"));
assert(html.includes("/js/hugo-blog-encrypt.js"));
assert(html.includes("/css/hugo-blog-encrypt.css"));

const index = fs.readFileSync(path.join(root, "public/index.json"), "utf8");
assert(!index.includes("hidden"));

console.log("Smoke test passed.");
