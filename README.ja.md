# hugo-blog-encrypt

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

Hugo 静的ブログ向けのビルド時暗号化ツールです。

Hugo が Markdown を通常どおり HTML に変換したあと、`hugo-blog-encrypt` が生成済みの `public` ディレクトリを走査し、マークされた HTML 断片を AES-256-GCM の暗号文に置き換えます。ページを開いたユーザーはブラウザ上でパスワードを入力し、フロントエンドのスクリプトが Web Crypto で内容を復号します。

## 機能

- **部分暗号化**: 記事内の一部だけをパスワードで保護します。
- **記事全体の暗号化**: 記事本文全体をパスワードで保護します。
- **preview モード**: Hugo のビルド、暗号化、ローカル静的プレビューを 1 コマンドで実行します。
- **セッション内パスワードキャッシュ**: 同じブラウザセッションでは、解錠済みの内容をリロード後に自動で復号しようとします。
- **検索インデックス保護**: `public/index.json` 内の保護対象記事から `content`、`summary`、`description` を削除します。

## 必要環境

- 使用しているテーマに対応した Hugo
- Node.js 18+

## インストール

### GitHub からインストール

```bash
npm install --save-dev github:Aoidayo/hugo-blog-encrypt
npm install -g github:Aoidayo/hugo-blog-encrypt
```

グローバルインストール後にコマンドが見つからない場合は、npm のグローバル bin ディレクトリが `PATH` に入っているか確認してください。

```bash
npm config get prefix
ls "$(npm config get prefix)/bin" | grep hugo-blog-encrypt
```

### ローカルチェックアウトからインストール

```bash
git clone git@github.com:Aoidayo/hugo-blog-encrypt.git
cd hugo-blog-encrypt
npm install -g .
```

Hugo プロジェクト内で使う場合:

```bash
npm install --save-dev /path/to/hugo-blog-encrypt
npm install -g /path/to/hugo-blog-encrypt
```

## Layouts の準備

部分暗号化には shortcode が必要です。記事全体の暗号化では、テーマごとに `.Content` の出力位置が異なるため、テーマの `.Content` 出力部分をラップする必要があります。

プロジェクトローカルにインストールする場合は、必要に応じて追加してください。

```gitignore
node_modules/
```

### 部分暗号化 shortcode

Hugo プロジェクトに `layouts/shortcodes/encrypt.html` を作成します。

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

### 記事全体暗号化用 partials

以下を作成します。

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

次に、`.Content` を出力しているテーマテンプレートをプロジェクトの `layouts` にコピーし、`.Content` をラップします。

```diff
 <section class="article-content">
+  {{ partial "hugo-blog-encrypt/content-start.html" . }}
   {{ .Content }}
+  {{ partial "hugo-blog-encrypt/content-end.html" . }}
 </section>
```

Stack テーマでは通常、`.Content` は `layouts/partials/article/components/content.html` にあります。

## 例

### 記事全体の暗号化

```markdown
---
title: "Hello Stack"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
password: "123"
prompt: "パスワードを入力してください"
---

この本文は Hugo のビルド後に暗号化されます。
```

### 部分暗号化

```markdown
---
title: "部分暗号化"
date: 2026-06-21T09:00:00+08:00
draft: false
---

ここは公開部分です。

{{< encrypt password="your-password" prompt="パスワードを入力してください" >}}
ここは暗号化される部分です。

## 見出し

- リスト
- 画像
- コードブロック
{{< /encrypt >}}
```

## 使い方

プロジェクトローカルにインストールした場合:

```bash
npx hugo-blog-encrypt --help
npx hugo-blog-encrypt preview
npx hugo-blog-encrypt build
```

グローバルインストールした場合:

```bash
hugo-blog-encrypt preview
hugo-blog-encrypt preview --port 1314
hugo-blog-encrypt build
```

Hugo プロジェクトの `package.json` に script を追加することもできます。

```json
{
  "scripts": {
    "dev": "hugo server",
    "build": "hugo-blog-encrypt build",
    "preview": "hugo-blog-encrypt preview"
  }
}
```

## 注意

- このプラグインはテーマの目次を変更したり再生成したりしません。目次の挙動はテーマ側に任せます。
- テーマが `.Summary`、`.Plain`、`.Content` を RSS や検索用ファイルに出力する場合は、漏えいを避けるためにテーマ側の追加対応が必要です。
- front matter のパスワードは文字列にしてください。例: `password: "123"`。`password: 123` は避けてください。
