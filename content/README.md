# 内容怎么更新

有两种方式：**在网页上直接发布**（推荐），或者手动改 `content/` 里的文件。

---

## 方式一：在网页上发布（只有你能用）

网站部署在 GitHub Pages 上。你在网页上点"发布"时，内容会通过 GitHub API 直接提交到你的仓库，Pages 大约 1 分钟后自动更新。
访客看不到任何编辑按钮；没有你的 Token，任何人都无法发布。

### 第一次设置（只需一次）

1. **把网站放到 GitHub**：新建一个仓库（例如 `你的用户名.github.io`），把整个网站文件夹推上去。
2. **开启 GitHub Pages**：仓库 → Settings → Pages → Source 选 `Deploy from a branch`，分支选 `main`，目录 `/ (root)`。
3. **创建 Token**：打开 <https://github.com/settings/personal-access-tokens/new>
   - Repository access：**Only select repositories**，只选这个网站仓库
   - Permissions → Repository permissions → **Contents：Read and write**
   - 生成后复制（以 `github_pat_` 开头）
4. **登录**：打开你的网站，在网址后面加上 `#admin`（例如 `https://你的用户名.github.io/#admin`），填写用户名、仓库名、分支和 Token。

登录后，页面右下角会出现管理栏：

- **✎ 写记录**：Markdown 编辑器，左边写、右边实时预览；支持公式、代码、表格，可以直接上传图片。草稿会自动保存在本机，`Ctrl+S` 发布。
- **＋ 加论文**：填表添加到档案库，可设置阅读状态、评分、一句话总结，关联自己的记录。
- 列表里每一项会出现 **编辑 / 删除** 按钮；在文章阅读页可以 **编辑本篇**。
- **⏻**：退出登录（清除这台设备上的 Token）。

> 安全提示：Token 只保存在你当前浏览器里。换设备需要重新登录；在公共电脑上用完记得退出。Token 泄露时到 GitHub 设置里删除它即可。

---

## 方式二：手动编辑文件

### 写一篇新记录

1. 在 `content/notes/` 里新建一个 Markdown 文件，例如 `my-first-note.md`
2. 在 `content/notes/index.json` 里加一条：

```json
{
  "slug": "my-first-note",
  "title": "标题",
  "date": "2026-11-11",
  "tags": ["学习总结"],
  "summary": "一两句话的摘要，会显示在列表里。"
}
```

`slug` 必须和文件名（去掉 `.md`）一致。记录会按日期从新到旧自动排序。

Markdown 支持：标题、列表、引用、表格、代码块、图片，以及数学公式（行内 `$...$`，独立一行 `$$...$$`）。

### 往档案库里加一篇论文

在 `content/papers.json` 里加一条：

```json
{
  "title": "论文标题",
  "authors": "First Author et al.",
  "venue": "CoRL",
  "year": 2025,
  "tags": ["VLA"],
  "status": "read",
  "rating": 4,
  "tldr": "一句话总结",
  "pdf": "https://arxiv.org/abs/xxxx.xxxxx",
  "code": "https://github.com/...",
  "note": "my-first-note"
}
```

- `status`：`read`（已读）/ `reading`（在读）/ `todo`（想读）
- `rating`：0–5，0 表示未评分
- `code`、`note` 可以省略；`note` 填某篇记录的 slug，会出现"笔记"链接

---

## 注意

内容是通过网络请求加载的，所以要用本地服务器预览（不能直接双击打开 html 文件）。
