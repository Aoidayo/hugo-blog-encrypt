# hugo-blog-encrypt

Hugo 静态博客的构建时加密工具。

工作方式：先让 Hugo 正常把 Markdown 渲染成 HTML，再由 `hugo-blog-encrypt` 扫描 `public` 目录，把标记过的 HTML 片段替换成 AES-256-GCM 密文。正常打开页面后，在浏览器里输入密码，前端脚本用 Web Crypto 解密并恢复内容。

功能
- **局部加密**：文章里某一段内容需要密码才能看。
- **整篇加密**：整篇文章正文需要密码才能看。
- **preview 模式**：一条命令完成 Hugo 构建、加密、启动本地静态预览。
- **密码会话缓存**：同一浏览器会话（SessionStorage）内，已经解锁过的内容刷新时会自动尝试解密。

#TODO 存在的一些问题
- **文章目录重建**：整篇/局部加密后，目录重新渲染。（这个需要针对不同的主题作适配，搁置）。
- **搜索索引保护**：自动清理 `public/index.json` 中受保护文章的 `content`、`summary`、`description` 字段。
- **RSS 防泄露**：提供 RSS 模板适配方式，避免 `.Summary` 把加密内容输出到 feed。

# 快速启动

## 环境要求

- hugo版本，与你使用主题要求的hugo版本一致
- node版本18+

## 依赖安装

### 远程

```bash
npm install --save-dev github:aoidayo/hugo-blog-encrypt # 项目中安装
npm install -g github:aoidayo/hugo-blog-encrypt # 全局安装
```


### 本地
在`blog-root`下面：
```bash
# 在本地安装依赖
npm install --save-dev /Users/xxx/code/hugo-blog-encrypt # 项目中安装
'''
得到
node_modules/
package.json
package-lock.json
'''

npm install -g /Users/aoi/code/hugo-blog-encrypt # 全局安装
```



## 准备layouts

需要修改的：
- 添加gitignore，使用npm安装依赖会添加node_modules（使用-g安装的依赖则可忽略这步）。
- 局部加密需要添加shortcodes。
- 整篇加密需要在layouts中包裹一次Content，插件不能自动拦截不同主题里 `.Content` 的输出位置。
- #TODO ：如果主题会把 `.Summary`、`.Plain`、`.Content` 输出到搜索或 RSS：需要额外适配，避免泄露。

1、在gitignore中添加，以忽略局部安装的依赖（如果你用npm install -g全局安装则可不加）：
```
node_modules/
```

> [!tip]+ Tip：第2、3步
> 第二步和第三步 可以在根目录下调用`hugo-blog-encrypt install`完成。
> 项目内安装的，可以使用`npx hugo-blog-encrypt install`。

> [!tip]- Tip：第2、3步，手动添加layouts
> 2、添加局部加密的shortcode
> 创建`blog-root/layouts/shortcodes/encrypt.html`，写入
> ```html
> {{- $password := .Get "password" | default (.Get 0) -}}
> {{- $prompt := .Get "prompt" | default "请输入密码" -}}
> {{- if not $password -}}
>   {{- errorf "encrypt shortcode in %q requires a password parameter" .Page.File.Path -}}
> {{- end -}}
> {{- if (.Page.Params.password | default "") -}}
> {{ .Page.RenderString .Inner }}
> {{- else -}}
> <template data-hugo-encrypt-start>{{ dict "password" $password "prompt" $prompt "kind" "partial" | jsonify }}</template>
> {{ .Page.RenderString .Inner }}
> <template data-hugo-encrypt-end></template>
> {{- end -}}
> 
> ```
> 
> 3、添加全局加密的partials，覆盖原`{{.Content}}`
> 在`blog-root/layouts/partials`添加整篇文章加密的定位partials
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
> <template data-hugo-encrypt-start>{{ dict "password" .Params.password "prompt" (.Params.prompt | default "请输入密码") "kind" "article" | jsonify }}</template>
> {{- end -}}
> 
> # content-end.html
> {{- if (.Params.password | default "") -}}
> <template data-hugo-encrypt-end></template>
> {{- end -}}
> ```

4、复制主题对应的contents出来，放在根目录的layouts下面

> [!warning] 注意
> 不同主题的`{{.Content}}`的位置不一样，可以直接`Ctrl/Command + shift + F`全局搜索后然后copy到根目录进行覆盖。

- 比如`stack`主题中`{{.Content}}`在`layout/partials/article/components/content.html` 中，复制到根目录同文件夹
```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
</section>
```
添加content-start和content-end定位标签：
```html
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
    {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
    {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```
diff如下：
```diff
<section class="article-content">
    <!-- Refer to https://discourse.gohugo.io/t/responsive-tables-in-markdown/10639/5 -->
    {{ $wrappedTable := printf "<div class=\"table-wrapper\">${1}</div>" }}
+   {{ partial "hugo-blog-encrypt/content-start.html" . }}
    {{ .Content | replaceRE "(<table>(?:.|\n)+?</table>)" $wrappedTable | safeHTML }}
+   {{ partial "hugo-blog-encrypt/content-end.html" . }}
</section>
```


## 示例文档

全文加密
```markdown
---
title: "Hello Stack"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
password: "123" # 必须是字符串，不能是数字
prompt: "那咋了？" # 默认"请输入密码"
---
This site is running the Stack theme version compatible with Hugo 0.143.1.
```

局部加密
```markdown
---
title: "局部加密"
date: 2026-06-21T09:00:00+08:00
draft: false
tags:
  - hugo
  - stack
---

这里是局部加密，👇下面是加密内容。

{{< encrypt password="你的密码" prompt="这里需要密码" >}}
这里是需要加密的内容。

支持正常 Markdown：

## 小标题

- 列表
- 图片
- 代码块
{{< /encrypt >}}
```

## 使用
### 项目中安装的使用方式
- 无法直接调用`hugo-blog-encrypt`
- 可以使用`npx hugo-blog-encrypt preview`加密后预览，`npx hugo-blog-encrypt build`进行`public/`的构建与加密。
    - `npx hugo-blog-encrypt --help`
    - `npx hugo-blog-encrypt preview/build`
- 可以修改本地的package.json，然后调用`npm run dev/build/preview`

```bash
##  在package.json中添加
'''
"scripts": {
  "dev": "hugo server",
  "build": "hugo-blog-encrypt build",
  "preview": "hugo-blog-encrypt preview"
}
'''

# 执行
npm run dev # 正常启动hugo，默认hugo server支持热部署。
npm run build # 生成hugo public，同时调用hugo-blog-encrypt完成指定标签的加密.
npm run preview # 生成hugo、加密、预览。不支持热部署，修改文档后需要重新调用该命令。
```

### 全局安装的使用方式
- 直接调用
    - `hugo-blog-encrypt preview`
    - `hugo-blog-encrypt preview --port 1314`
    - `hugo-blog-encrypt build`



