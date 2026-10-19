# OpenOpticSim 1.0.0 验收报告

日期：2026-10-19。范围：保留 0.9 全部计算与工作流，重组界面，增加离线帮助与 PDF 名义技术图纸。旧报告归档为 TEST_REPORT_0.9.md。

## 已通过的验证

| 项目 | 实测结果 |
| --- | --- |
| 前端回归 | 9 个文件、54 项通过；含旧格式往返、候选过期保护、机械轮廓、全部功能入口与帮助链接完整性 |
| Rust / 桌面 | 72 项核心 + 4 项原生测试，合计 76 项通过；包含新增 PDF 原子保存和错误覆盖保护 |
| 静态检查 | TypeScript / Vite 生产构建通过；cargo clippy --workspace --all-targets --locked -- -D warnings 通过 |
| 导航 | 生产构建的 14 个工具均实际打开；设计 / 画质 / 调校 / 交付，以及基础 / 专业编辑保留 |
| 离线文档 | 20 章完整帮助、新手教程、术语和技术说明；无空文档和悬空内部链接；独立 HTML / Markdown 同源生成 |
| 帮助检索 | 生产界面实际检索“角落 MTF”，5 篇匹配，展示摘要、匹配高亮与上下文跳转 |
| 文件兼容 | 实际打开 0.8 UI 文件，保留旧扫描、目标、优化变量和镜组；升级传感器联动为 v3 后保存重开 |
| 持久化重开 | 34 面、4 个命名版本、2 个镜组、完整旧扫描与约束；材料和光学表面完全不变 |
| 同尺度对比 | 共同像面、33×33；每侧 9,564 条采样，全部无失败，A/B 分析完全一致；共同光斑范围 0.046313878147829605 mm |
| 旧扫描复现 | 保存扫描的所有旧字段精确重现；新覆盖字段不强行与旧结构比较 |
| 光学元数据不变性 | analyze、wave 和 preview 在带工作区与独立处方之间结果完全一致 |
| 400 mm 数值回归 | 65×65、38,508 条采样无失败，视场摘要与完整覆盖信息精确等于 0.9 基准 |
| 桌面启动 | 1.0.0 发布 exe 启动 5 秒持续运行、响应正常、窗口标题正确 |
| 安装资源 | 32 个明示资源文件与源文件 SHA-256 一致，包含 20 篇手册、合并手册、示例和字体许可 |

对比两边投影到同一绝对 Z 像面时，末面间隔的减法舍入差约 5.68e-14 mm；实际引擎分析与共用尺度完全一致。原始用户 400mm.oos.json 的 SHA-256 仍为 84627E7A4C374417169E2C1FCAF6FD88A951C7AB4ED5EF034A32E01B5E67B561，未修改。

## PDF 技术图纸

生成并逐页渲染、检查了三份模块样张和一份实际生产界面导出：

- 400 mm 传感器工作区：25 页，四视场多色快速 PSF / MTF 均收敛，几何无失败。
- 35 mm 全画幅覆盖教学镜头：12 页，实际约 34.0633°角落直接 Kirchhoff 成功；该教学镜头的低边缘画质不是经过校正的摄影镜头性能。
- 无效曲面草稿：20 页，清楚标注草稿与定义域无效面，不画替代曲面、不冒用旧计算。
- 生产构建从真实 UI 导出的 400 mm 验收项目：26 页，四视场多色快速 PSF / MTF 均收敛，几何无失败；与其保存重开的源项目完全一致。

全部检查中文可提取检索、页数与页码、文字起点边界、源项目附件与原始精度、首页 SHA-256 和全部页面栅格化。逐页接触表与处方/分图/MTF 页已人工视觉检查，无明显重叠、缺字或截断。剖面是矢量；PSF 是带物理尺度的灰度图。固定当前像面，几何 33×33，衍射上限 256；未请求或未完成的分析明确记录。

PDF 内嵌 project.oos.json 与 analysis.json。原生项目完整保留工作区、版本、扫描源和精确参数；分析摘要省略大型光线、点列和 PSF 数组。新字体为 Noto Sans SC regular 静态实例，OFL、上游哈希与转换记录随包分发。未收录字符会用问号显示，附件原文不变。

实际 UI 也验证了取消逐场衍射导出：取消后处方保持不变。生产资源在同源、无远程脚本且不允许 unsafe-eval 的 CSP 下完成 Worker、字体和完整下载，生产控制台无错误或警告。开发中依赖热更新曾使旧 Vite 缓存产生 React 重复实例提示；最终验收采用独立生产构建，不沿用该开发缓存。

## 证据

- [生产 UI 验证](validation-ui-1.0.json)；[界面截图](screenshots/studio-1.0.png)；[检索截图](screenshots/help-1.0.png)。
- [保存重开文件](fixtures/workspace-ui-saved-1.0.oos.json)；[实际版本对比报告](fixtures/version-comparison-ui-1.0.json)。
- [数值与旧扫描回归](validation-design-saved-1.0.json)。0.9 的独立 RayOptics / NumPy 证据继续适用，本次没有变更光学算法，也没有重新声称全新独立物理认证。
- [PDF 样张验证](validation-pdf-1.0.json)；[生产 UI PDF 验证](validation-pdf-production-1.0.json)。
- [发布校验信息](release-1.0.json)；[启动记录](startup-1.0.json)。

## 重现

```powershell
pnpm install --frozen-lockfile
pnpm test
pnpm build
cargo test --workspace --release --locked
cargo clippy --workspace --all-targets --locked -- -D warnings
cargo build -p oos-cli --release --locked
python scripts/validate_saved_design.py
node scripts/render_drawings.mjs
python -m pip install -r scripts/requirements-pdf-validation.txt
python scripts/validate_pdf.py
pnpm release:build
```

PDF 栅格化还需 Poppler 的 pdftoppm（PATH 或 OOS_PDFTOPPM）。独立光学验证的 Python 依赖与 PDF 检查依赖均不进入产品运行环境。可选 node scripts/serve_release.mjs 提供仅本机 1421 端口的生产资源 QA 服务；桌面安装版不需要该服务。

## 发布边界

- 安装包含 WebView2 离线安装组件；已构建并启动 exe，但尚未在无 WebView2 的干净 Windows 虚拟机完成断网安装验收，安装包未签名。
- 原生 PDF 写入经过单元测试；完整界面流程在生产浏览器实现验证。原生文件对话框和原生快捷键尚未全程自动化验收。
- 图纸是名义设计记录，不补造加工公差、镀膜、表面质量或装配基准，不能直接作为完整加工验收依据。
- 保持 0.9 的标量衍射、稳定瞳分支与有限像面窗口限制；没有增加真实三维场景、完整整幅空间变化渲染、公差、偏振或鬼影分析。
- 本地通过不等于远程 CI 已运行，不声称新用户可用性研究或任意实际镜头精度认证完成。
