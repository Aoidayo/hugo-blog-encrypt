# hugo-blog-encrypt

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

A build-time encryption tool for Hugo static blogs.

It lets Hugo render Markdown to HTML first, then scans the generated `public` directory and replaces marked HTML fragments with AES-256-GCM ciphertext. When a visitor opens the page, they enter a password in the browser, and the frontend script decrypts the content with Web Crypto.

## Features

- **Partial encryption**: Protect only part of an article.
- **Full article encryption**: Protect the full article body.
- **Preview mode**: Build Hugo, encrypt output, and serve a local static preview with one command.
- **Session password cache**: Content unlocked in the same browser session is automatically retried after refresh.
- **Search index protection**: Scrubs `content`, `summary`, and `description` from protected entries in `public/index.json`.

## Requirements

- Hugo version compatible with your theme
- Node.js 18+

## Installation

### Install from GitHub

```bash
npm install --save-dev github:Aoidayo/hugo-blog-encrypt
npm install -g github:Aoidayo/hugo-blog-encrypt
```

If the global command is not found after installation, check whether npm's global bin directory is in your `PATH`:

```bash
npm config get prefix
ls "$(npm config get prefix)/bin" | grep hugo-blog-encrypt
```

### Install from a local checkout

```bash
git clone git@github.com:Aoidayo/hugo-blog-encrypt.git
cd hugo-blog-encrypt
npm install -g .
```

Inside a Hugo project:

```bash
npm install --save-dev /path/to/hugo-blog-encrypt
npm install -g /path/to/hugo-blog-encrypt
```

## Prepare Layouts

Partial encryption needs a shortcode. Full article encryption needs you to wrap the theme's `.Content` output because different themes place `.Content` in different templates.

Add this when installing locally in a project:

```gitignore
node_modules/
```

### Partial Encryption Shortcode

Create `layouts/shortcodes/encrypt.html` in your Hugo project:

```html
{{- $password := .Get "password" | default (.Get 0) -}}
{{- $prompt := .Get "prompt" | default "请输入密码" -}}
{{- if not $password -}}
  {{- errorf "encrypt shortcode in %q requires a password parameter" .Page.File.Path -}}
{{- end -}}
{{- if (.Page.Params.password | default "") -}}
{{ .Page.RenderString .Inner }}
{{- else -}}
<template data-hugo-encrypt-start>{{ dict "password" $password "prompt" $prompt | jsonify }}</template>
{{ .Page.RenderString .Inner }}
<template data-hugo-encrypt-end></template>
{{- end -}}
```

### Full Article Partials

Create:

```text
layouts/partials/hugo-blog-encrypt/content-start.html
layouts/partials/hugo-blog-encrypt/content-end.html
```

`content-start.html`:

```html
{{- if (.Params.password | default "") -}}
<template data-hugo-encrypt-start>{{ dict "password" .Params.password "prompt" (.Params.prompt | default "请输入密码") | jsonify }}</template>
{{- end -}}
```

`content-end.html`:

```html
{{- if (.Params.password | default "") -}}
<template data-hugo-encrypt-end></template>
{{- end -}}
```

Then copy the theme template that renders `.Content` into your project `layouts` directory and wrap `.Content`:

```diff
 <section class="article-content">
+  {{ partial "hugo-blog-encrypt/content-start.html" . }}
   {{ .Content }}
+  {{ partial "hugo-blog-encrypt/content-end.html" . }}
 </section>
```

For the Stack theme, `.Content` is usually in `layouts/partials/article/components/content.html`.

## Examples

### Full Article Encryption

```markdown
---
title: "Hello Stack"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
password: "123"
prompt: "Password required"
---

This content is encrypted after Hugo builds the page.
```

### Partial Encryption

```markdown
---
title: "Partial Encryption"
date: 2026-06-21T09:00:00+08:00
draft: false
---

This part is public.

{{< encrypt password="your-password" prompt="Password required" >}}
This part is encrypted.

## Heading

- List
- Image
- Code block
{{< /encrypt >}}
```

## Usage

Project-local install:

```bash
npx hugo-blog-encrypt --help
npx hugo-blog-encrypt preview
npx hugo-blog-encrypt build
```

Global install:

```bash
hugo-blog-encrypt preview
hugo-blog-encrypt preview --port 1314
hugo-blog-encrypt build
```

You can also add scripts to your Hugo project's `package.json`:

```json
{
  "scripts": {
    "dev": "hugo server",
    "build": "hugo-blog-encrypt build",
    "preview": "hugo-blog-encrypt preview"
  }
}
```

## Notes

- The plugin does not modify or rebuild a theme's table of contents. Your theme's TOC behavior stays unchanged.
- If your theme outputs `.Summary`, `.Plain`, or `.Content` into RSS or search files, add theme-specific protection to avoid leaks.
- Passwords should be strings in front matter, for example `password: "123"`, not `password: 123`.
