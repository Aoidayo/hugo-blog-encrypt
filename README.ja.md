# hugo-blog-encrypt

[中文](README.md) | [English](README.en.md) | [日本語](README.ja.md)

[デモサイト](https://blog.aoidayo.site/hugo-encrypt-showcase/)

Hugo 静的ブログ向けのビルド時暗号化ツールです。

仕組み：まず Hugo に通常どおり Markdown を HTML にレンダリングさせ、その後 `hugo-blog-encrypt` が `public` ディレクトリをスキャンし、マークされた HTML 断片を AES-256-GCM の暗号文に置き換えます。ページを通常どおり開いた後、ブラウザ上でパスワードを入力すると、フロントエンドスクリプトが Web Crypto を使って復号し、内容を復元します。

機能

* **部分暗号化**：記事内の一部コンテンツを、パスワード入力後に閲覧できるようにします。
* **記事全体の暗号化**：記事本文全体を、パスワード入力後に閲覧できるようにします。
* **preview モード**：1 つのコマンドで Hugo のビルド、暗号化、ローカル静的プレビューの起動まで行います。
* **パスワードのセッションキャッシュ**：同一ブラウザセッション（SessionStorage）内では、一度解除したコンテンツはリロード時に自動で復号を試みます。

## 既知の問題

* **記事目次の再構築**：記事全体または部分暗号化後に、目次の再レンダリングは行いません。目次はテーマ側で通常どおり生成され、本プラグインはテーマへの個別対応を行いません。
* **検索インデックスの保護**：`public/index.json` 内の保護対象記事について、`content`、`summary`、`description` フィールドは自動的にクリアされます。ただし、その他の検索インデックスファイルについてはテーマごとの追加対応が必要です。
* **RSS からの漏洩防止**：`.Summary` によって暗号化対象の内容が feed に出力されないよう、RSS テンプレートの適配方法を用意する必要があります。

# クイックスタート

## 環境要件

* Hugo のバージョンは、使用しているテーマが要求する Hugo バージョンと一致している必要があります。
* Node.js 18+

## 依存関係のインストール

### リモート

```bash
# リモートインストール方式には問題がある可能性があります
npm install --save-dev github:aoidayo/hugo-blog-encrypt # プロジェクト内にインストール
npm install -g github:aoidayo/hugo-blog-encrypt # グローバルインストール

# pull 後にローカルで install する方法を推奨
git pull git@github.com:Aoidayo/hugo-blog-encrypt.git
cd hugo-blog-encrypt
npm install -g .
```

### ローカル

`blog-root` 配下で：

```bash
# ローカル依存関係としてインストール
npm install --save-dev /Users/xxx/code/hugo-blog-encrypt # プロジェクト内にインストール
'''
生成されるもの
node_modules/
package.json
package-lock.json
'''

npm install -g /Users/aoi/code/hugo-blog-encrypt # グローバルインストール
```

## layouts の準備

修正が必要な内容：

* `gitignore` を追加します。npm で依存関係をインストールすると `node_modules` が追加されます（`-g` でグローバルインストールする場合、この手順は不要です）。
* 部分暗号化には shortcode の追加が必要です。
* 記事全体の暗号化では、layouts 内で `.Content` を一度ラップする必要があります。プラグインは、テーマごとに異なる `.Content` の出力位置を自動ではフックできません。
* テーマが `.Summary`、`.Plain`、`.Content` を検索または RSS に出力する場合は、漏洩を防ぐために追加の適配が必要です。

1. 局所インストールした依存関係を無視するため、`gitignore` に以下を追加します（`npm install -g` でグローバルインストールする場合は不要です）：

```text
node_modules/
```

> [!tip]
> 手順 2、3：自動設定
>
> 手順 2 と 3 は、ルートディレクトリで `hugo-blog-encrypt install` を実行することで完了できます。
>
> プロジェクト内にインストールした場合は、`npx hugo-blog-encrypt install` を使用できます。

> [!tip]
> 手順 2、3：手動で layouts を追加
>
> 2. 部分暗号化用の shortcode を追加します。
>
> `blog-root/layouts/shortcodes/encrypt.html` を作成し、以下を書き込みます。
>
> ```html
> {{- $password := .Get "password" | default (.Get 0) -}}
> {{- $prompt := .Get "prompt" | default "パスワードを入力してください" -}}
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
> 3. 記事全体暗号化用の partials を追加し、元の `{{.Content}}` をラップします。
>
> `blog-root/layouts/partials` に、記事全体暗号化の位置指定用 partials を追加します。
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
> <template data-hugo-encrypt-start>{{ dict "password" .Params.password "prompt" (.Params.prompt | default "パスワードを入力してください") | jsonify }}</template>
> {{- end -}}
>
> # content-end.html
> {{- if (.Params.password | default "") -}}
> <template data-hugo-encrypt-end></template>
> {{- end -}}
> ```

4. テーマに対応する content テンプレートをコピーし、ルートディレクトリの `layouts` 配下に配置します。

> [!warning]
> 注意
>
> テーマによって `{{.Content}}` の位置は異なります。`Ctrl/Command + Shift + F` でグローバル検索し、該当ファイルをルートディレクトリにコピーして上書きできます。

例えば `stack` テーマでは、`{{.Content}}` は `layout/partials/article/components/content.html` にあります。同じディレクトリ構成でルートディレクトリ側にコピーします。

```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
</section>
```

`content-start` と `content-end` の位置指定タグを追加します。

```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
    {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```

diff は以下のとおりです。

```diff
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
+   {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
+   {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```

## サンプルドキュメント

記事全体の暗号化

```markdown
---
title: "Hello Stack"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
password: "123" # 必ず文字列にしてください。数値は使用できません
prompt: "それがどうした？" # デフォルトは "パスワードを入力してください"
---
This site is running the Stack theme version compatible with Hugo 0.143.1.
```

部分暗号化

```markdown
---
title: "部分暗号化"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
---

ここは部分暗号化の例です。👇 以下が暗号化される内容です。

{{< encrypt password="あなたのパスワード" prompt="ここにはパスワードが必要です" >}}
ここは暗号化が必要な内容です。

通常の Markdown に対応しています。

## 小見出し

- リスト
- 画像
- コードブロック
{{< /encrypt >}}
```

## 使用方法

### プロジェクト内にインストールした場合

* `hugo-blog-encrypt` を直接呼び出すことはできません。
* `npx hugo-blog-encrypt preview` で暗号化後のプレビューを行い、`npx hugo-blog-encrypt build` で `public/` のビルドと暗号化を実行できます。

  * `npx hugo-blog-encrypt --help`
  * `npx hugo-blog-encrypt preview/build`
* ローカルの `package.json` を編集し、`npm run dev/build/preview` を呼び出すこともできます。

```bash
## package.json に追加
'''
"scripts": {
  "dev": "hugo server",
  "build": "hugo-blog-encrypt build",
  "preview": "hugo-blog-encrypt preview"
}
'''

# 実行
npm run dev # Hugo を通常起動します。デフォルトの hugo server はホットリロードに対応しています。
npm run build # Hugo の public を生成し、同時に hugo-blog-encrypt を呼び出して指定タグの暗号化を完了します。
npm run preview # Hugo の生成、暗号化、プレビューを行います。ホットリロードには対応していないため、ドキュメント変更後はこのコマンドを再実行する必要があります。
```

### グローバルインストールした場合

* 直接呼び出します。

  * `hugo-blog-encrypt preview`
  * `hugo-blog-encrypt preview --port 1314`
  * `hugo-blog-encrypt build`
