# hugo-blog-encrypt

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

[Example Site](https://blog.aoidayo.site/hugo-encrypt-showcase/)

A build-time encryption tool for Hugo static blogs.

How it works: Hugo first renders Markdown into HTML normally. Then `hugo-blog-encrypt` scans the `public` directory and replaces marked HTML fragments with AES-256-GCM ciphertext. After opening the page normally, the user enters the password in the browser, and the frontend script uses Web Crypto to decrypt and restore the content.

Features

* **Partial encryption**: Encrypt a specific part of an article, requiring a password to view it.
* **Full article encryption**: Encrypt the entire article body, requiring a password to view it.
* **Preview mode**: Build Hugo, encrypt the output, and start a local static preview with a single command.
* **Password session cache**: Within the same browser session via SessionStorage, previously unlocked content will automatically attempt to decrypt after refresh.



## Known Issues

* **Table of contents rebuilding**: The table of contents is not re-rendered after full or partial encryption. The TOC is generated normally by the theme, and this plugin does not perform theme-specific adaptation.
* **Search index protection**: The `content`, `summary`, and `description` fields of protected articles in `public/index.json` are automatically cleared. Other search index files require additional theme-specific adaptation.
* **RSS leakage prevention**: RSS template adaptation is required to prevent `.Summary` from outputting encrypted content into feeds.

# Quick Start

## Requirements

* Hugo version: must match the Hugo version required by your theme.
* Node.js 18+

## Installing Dependencies

### Remote

```bash
# Remote installation seems to have some issues
npm install --save-dev github:aoidayo/hugo-blog-encrypt # Install inside the project
npm install -g github:aoidayo/hugo-blog-encrypt # Global installation

# Recommended: pull the repository and install locally
git pull git@github.com:Aoidayo/hugo-blog-encrypt.git
cd hugo-blog-encrypt
npm install -g .
```

### Local

Under `blog-root`:

```bash
# Install dependency locally
npm install --save-dev /Users/xxx/code/hugo-blog-encrypt # Install inside the project
'''
Result:
node_modules/
package.json
package-lock.json
'''

npm install -g /Users/aoi/code/hugo-blog-encrypt # Global installation
```

## Preparing layouts

Required changes:

* Add `gitignore`. Installing dependencies with npm will add `node_modules`. If you install globally with `-g`, this step can be ignored.
* Partial encryption requires adding a shortcode.
* Full article encryption requires wrapping `Content` once in `layouts`. The plugin cannot automatically intercept the output location of `.Content` across different themes.
* If your theme outputs `.Summary`, `.Plain`, or `.Content` to search or RSS, additional adaptation is required to prevent leakage.

1. Add the following to `gitignore` to ignore locally installed dependencies. If you use `npm install -g` for global installation, this is not required:

```text
node_modules/
```

> [!tip]
> Steps 2 and 3: Automatic configuration
>
> Steps 2 and 3 can be completed by running `hugo-blog-encrypt install` in the root directory.
>
> If installed inside the project, use `npx hugo-blog-encrypt install`.

> [!tip]
> Steps 2 and 3: Manually add layouts
>
> 2. Add the shortcode for partial encryption.
>
> Create `blog-root/layouts/shortcodes/encrypt.html` and write:
>
> ```html
> {{- $password := .Get "password" | default (.Get 0) -}}
> {{- $prompt := .Get "prompt" | default "Please enter the password" -}}
> {{- if not $password -}}
>   {{- errorf "encrypt shortcode in %q requires a password parameter" .Page.File.Path -}}
> {{- end -}}
> {{- if (.Page.Params.password | default "") -}}
> {{ .Page.RenderString .Inner }}
> {{- else -}}
> <template data-hugo-encrypt-start>{{ dict "password" $password "prompt" $prompt | jsonify }}</template>
> {{ .Page.RenderString .Inner }}
> <template data-hugo-encrypt-end></template>
> {{- end -}}
>
> ```
>
> 3. Add partials for full article encryption to wrap the original `{{.Content}}`.
>
> Add the positioning partials for full article encryption under `blog-root/layouts/partials`:
>
> ```bash
> - blog-root
>     - layouts
>         - partials
>             - hugo-blog-encrypt
>                 - content-start.html
>                 - content-end.html
>
> # content-start.html
> {{- if (.Params.password | default "") -}}
> <template data-hugo-encrypt-start>{{ dict "password" .Params.password "prompt" (.Params.prompt | default "Please enter the password") | jsonify }}</template>
> {{- end -}}
>
> # content-end.html
> {{- if (.Params.password | default "") -}}
> <template data-hugo-encrypt-end></template>
> {{- end -}}
> ```

4. Copy the corresponding content template from your theme and place it under the root `layouts` directory.

> [!warning]
> Note
>
> The position of `{{.Content}}` differs by theme. You can search globally with `Ctrl/Command + Shift + F`, then copy the corresponding file to the root directory to override it.

For example, in the `stack` theme, `{{.Content}}` is located at `layout/partials/article/components/content.html`. Copy it to the same path under the root directory:

```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
</section>
```

Add the `content-start` and `content-end` positioning tags:

```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
    {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```

The diff is as follows:

```diff
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
+   {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
+   {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```

## Example Documents

Full article encryption:

```markdown
---
title: "Hello Stack"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
password: "123" # Must be a string, not a number
prompt: "So what?" # Default: "Please enter the password"
---
This site is running the Stack theme version compatible with Hugo 0.143.1.
```

Partial encryption:

```markdown
---
title: "Partial Encryption"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
---

This is partial encryption. 👇 The following content is encrypted.

{{< encrypt password="your password" prompt="Password required here" >}}
This is content that requires encryption.

Normal Markdown is supported:

## Subheading

- List
- Image
- Code block
{{< /encrypt >}}
```

## Usage

### When installed inside the project

* You cannot directly call `hugo-blog-encrypt`.
* You can use `npx hugo-blog-encrypt preview` to preview after encryption, and `npx hugo-blog-encrypt build` to build and encrypt `public/`.

  * `npx hugo-blog-encrypt --help`
  * `npx hugo-blog-encrypt preview/build`
* You can also modify the local `package.json`, then run `npm run dev/build/preview`.

```bash
## Add to package.json
'''
"scripts": {
  "dev": "hugo server",
  "build": "hugo-blog-encrypt build",
  "preview": "hugo-blog-encrypt preview"
}
'''

# Run
npm run dev # Start Hugo normally. By default, hugo server supports hot reload.
npm run build # Generate Hugo public output and call hugo-blog-encrypt to encrypt the specified tags.
npm run preview # Generate Hugo output, encrypt it, and preview it. Hot reload is not supported; rerun this command after modifying documents.
```

### When installed globally

* Call directly:

  * `hugo-blog-encrypt preview`
  * `hugo-blog-encrypt preview --port 1314`
  * `hugo-blog-encrypt build`
