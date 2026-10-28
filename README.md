# 工作台 · Work Tools

React + Vite 静态工作工具站。图片处理使用浏览器 Canvas，无后端、无上传。

## 功能

- PNG / JPG 格式互转，转换后预览及下载
- 修改宽高、锁定原图比例
- JPG 质量调节及透明区域背景色
- 显示转换前后体积；PNG 通过缩小尺寸减小体积，质量滑块仅适用于 JPG
- 文件限制 40 MB、4000 万像素；导出单边最长 16000 px

## 本地运行

需要 Node.js 22。

```sh
npm install
npm run dev
```

访问终端输出的本地地址。生产构建：`npm run build`；预览构建：`npm run preview`。

## 部署到 GitHub Pages

1. 在 GitHub 创建空仓库，例如 `tool-for-work`，不要初始化 README。
2. 在本目录运行以下命令，将 USERNAME 替换成你的用户名：

```sh
git init -b main
git add .
git commit -m "Build React work tools and image converter"
git remote add origin https://github.com/USERNAME/tool-for-work.git
git push -u origin main
```

3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 在 **Actions** 中查看 Deploy to GitHub Pages 工作流；如首次执行失败，在启用 Pages 后重新运行。
5. 部署成功后访问 `https://USERNAME.github.io/tool-for-work/`。

已配置 `.github/workflows/deploy.yml`，以后推送到 main 会自动构建并部署。Vite 使用相对资源路径，兼容项目仓库路径和 `USERNAME.github.io` 根站点。

若使用根站点仓库 `USERNAME.github.io`，替换上面的仓库名，网址为 `https://USERNAME.github.io/`。若已有 GitHub Pages 主站，可以把本项目放在独立仓库，通过子路径访问。

## 后续扩展

目前工具界面在 `src/main.jsx`，样式在 `src/style.css`。增加工具时可以拆分为 `src/tools/` 下的 React 组件，并在侧边栏添加入口。静态站适合本地文件处理、文本处理、时间和编码转换等功能；需要保密 API 密钥的功能应另设后端。

参考：https://vite.dev/guide/static-deploy/#github-pages

## 四图导出

左侧选择「四图导出」，填写纯数字编号（例如 863），上传图片后生成：

- `863.1-1200x900.jpg`
- `863.1-1200x900.png`
- `863.1-600x450.jpg`
- `863.1-600x450.png`

可下载包含四个文件的 ZIP，或分别下载。JPG 使用质量 1.0，PNG 无损编码；每个尺寸直接从原图生成。尺寸调整不可避免会改变像素，JPG 仍为有损格式，放大不能恢复原图细节。默认保持原图比例完整显示，JPG 留白为白色、PNG 为透明；也可选居中裁剪或拉伸。

## 基金 PDF 打包

「基金 PDF」中一次选择同一编号的四份 PDF，上传顺序不限，系统从原始文件名识别编号和类型：

- `CF 624 Fund Limited Liability Company Agreement.pdf`
- `CF 624 Fund Private Placement Memorandum.pdf`
- `CF 624 Fund Subscription Agreement_Reg. D.pdf`
- `CF 624 Fund Subscription Agreement_Reg. S.pdf`

生成五份文件，可单独下载或打包 ZIP：

| 输出 | 内容顺序 | 页数要求 |
| --- | --- | --- |
| `oper_agr_624.pdf` | LLC → PPM | 必须共 100 页 |
| `624_sign_doc_regs.pdf` | Reg. S → LLC → PPM | Reg. S 原件至少 9 页 |
| `624_sign_doc_regd.pdf` | Reg. D → LLC → PPM | Reg. D 原件至少 8 页 |
| `subagree_624us.pdf` | Reg. D 原件，仅改名 | 原样保留 |
| `subagree_624nonus.pdf` | Reg. S 原件，仅改名 | 原样保留 |

签名页位置以原件第 8 / 9 页本身是所需签名页为前提。工具不识别内容或移动签名页，提供原件和输出的页码查看链接。页数不符不截断或补白。合并保留页面尺寸和文字/图像内容，不栅格化；可填写表单的当前外观固定为页面内容。两份重命名文件字节保持不变。暂不支持密码保护或 XFA PDF。文件总大小不超过 160 MB，全部处理在浏览器完成。

PDF 实现参考：[页面复制](https://pdf-lib.js.org/docs/api/classes/pdfdocument#copypages)、[表单外观固定](https://pdf-lib.js.org/docs/api/classes/pdfform#flatten)。

运行 `npm test` 检查文件识别、页序、页数、页面尺寸及旋转、重命名内容一致性和输入异常。GitHub Actions 会在部署前自动执行这些检查。
