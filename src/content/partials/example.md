同一段内容要出现在多个页面时，放在 `src/content/partials/` 里维护一份，在 `.mdx` 页面里用 `<Render file="example" />` 引入。这个目录为空时构建会提示找不到文件，不影响结果。
