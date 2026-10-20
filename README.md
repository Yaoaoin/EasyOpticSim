# EasyOpticSim Y1.1

面向摄影与镜头爱好者的本地光学设计工作室。EasyOpticSim 使用 React、Tauri 2 和 Rust，将复杂的镜头设计、调校和检验整理成新手也能跟随的流程；Windows x64 是主要发布平台。

当前用户版本为 **Y1.1**，内部语义版本为 `1.1.0-y1.1`。当前仓库：[Yaoaoin/EasyOpticSim](https://github.com/Yaoaoin/EasyOpticSim)。本项目由 [Ayr1k/OpenOpticSim](https://github.com/ayr1k/OpenOpticSim) fork 并继续开发，保留原项目 Apache License 2.0、版权声明、[NOTICE](NOTICE) 和全部[第三方许可](THIRD_PARTY_NOTICES.txt)。项目改名不改变上游代码的许可证或归属。

## Y1.1 新功能

- 一键镜头体检：按固定顺序检查数据、机械、通光、几何画质、焦点、设计目标和快速 PSF/MTF。
- 五类可行动结果：能否成像、是否通光、画质、机械结构、是否适合导出；明确区分“可以继续、建议改进、必须修复、尚未检查”。
- 安全智能建议：自动对焦和优化只生成候选，显示前后差异与完整约束，通过后仍需用户确认采纳。
- 问题定位：几何或追迹失败可直接前往首个问题面；口径、光圈和画质问题进入对应工具。
- 首次启动五步引导、工作区“跟我做”进度和可随时重开的教程。
- 人像、广角、长焦、近物四类教学模板；每个模板明确是设计起点，不冒充已达标成品。
- 项目与程序统一改名为 EasyOpticSim；新项目默认保存为 `.eos.json`，继续兼容旧 `.oos.json` 和 CSV。

Y1.0 的三步新建向导、简单/专业双模式、四步任务导航和冰川蓝玻璃界面全部保留。完整内容见 [Y1.1 版本说明](docs/releases/Y1.1.md)、[更新日志](CHANGELOG.md)与 [GitHub Release 文案](docs/github-release-Y1.1.md)。

## 下载

发布后可从 Y1.1 Release 下载：

- [Windows x64 安装包](https://github.com/Yaoaoin/EasyOpticSim/releases/download/Y1.1/EasyOpticSim_1.1.0-y1.1_x64-setup.exe)
- [安装包 SHA-256](https://github.com/Yaoaoin/EasyOpticSim/releases/download/Y1.1/EasyOpticSim_1.1.0-y1.1_x64-setup.exe.sha256)
- [Y1.1 发布页](https://github.com/Yaoaoin/EasyOpticSim/releases/tag/Y1.1)

安装包包含离线 WebView2 组件、中文字体、完整手册、示例和许可文件。普通用户不需要安装 Node.js、Python 或 Rust。安装包目前未签名；请仅从本仓库下载并核对 SHA-256。

## 三分钟开始

1. 点击“新建项目”，选择人像、风景、远摄或近物。
2. 选择推荐教学模板，创建后跟随顶部四个步骤。
3. 用自动对焦或约束优化生成候选，检查结果后再采纳。
4. 打开“检查与保存 → 一键镜头体检”。
5. 按失败卡片的按钮定位问题、生成修复候选或进入专业诊断。
6. 保存 `.eos.json`，或导出体检报告与技术图纸。

第一次启动会显示五步界面引导；顶部“跟我做”可重新打开。软件内帮助、F1 或 Ctrl+K 可检索说明。也可直接阅读 [EasyOpticSim Y1.1 完整手册](docs/EasyOpticSim-Y1.1-使用手册.md)、[离线 HTML 手册](docs/EasyOpticSim-Y1.1-使用手册.html)和[一键体检说明](docs/manual/health.md)。

## 能力与边界

简单模式和专业模式使用同一 Rust 双精度顺序追迹核心。专业模式保留镜头处方、几何检查、材料、传感器视场、瞳面、自动对焦、光圈扫描、镜组运动、多配置、PSF/MTF、测试图成像、约束优化、版本比较和 PDF 技术图纸。

体检“通过”只表示当前处方在记录的视场、波长、采样和模型范围内没有发现阻断项。它不代表加工公差、镀膜、杂散光、机械强度、装配或真实相机系统已经认证。详细范围见 [STATUS](docs/STATUS.md)、[COVERAGE](docs/COVERAGE.md)、[DIFFRACTION](docs/DIFFRACTION.md)和[测试报告](docs/TEST_REPORT.md)。

## 从源码运行

需要 Node.js 24、pnpm 11.25 和 Rust stable。Windows 桌面构建还需要 Visual Studio C++ Build Tools、Windows SDK 与 WebView2。

```powershell
pnpm install --frozen-lockfile
cargo build -p easyopticsim-cli --locked
pnpm dev
```

开发界面位于 `http://127.0.0.1:1420/`。生产 Web 静态预览不包含本地 Rust 引擎。

## 测试和发布构建

```powershell
pnpm test
pnpm build
cargo test --workspace --locked --release
cargo clippy --workspace --all-targets --locked -- -D warnings
pnpm release:build
python scripts/stage_release.py
```

CLI 示例：

```powershell
cargo run -p easyopticsim-cli -- examples
cargo run -p easyopticsim-cli -- analyze examples/singlet.oos.json
cargo run -p easyopticsim-cli -- validate examples/singlet.oos.json
```

完整接口通过 `easyopticsim-cli --request` 从 stdin 接收 JSON。发布流程见 [RELEASING](docs/RELEASING.md)，贡献要求见 [CONTRIBUTING](CONTRIBUTING.md)。

## 许可证与致谢

EasyOpticSim 继续依据 Apache License 2.0 分发。原始 OpenOpticSim 项目由 Ayr1k 与 OpenOpticSim contributors 开发；本 fork 的 EasyOpticSim 界面、引导和检验工作流由 Yaoaoin/EasyOpticSim 维护。所有上游版权、NOTICE、第三方许可证、Noto Sans SC 的 SIL OFL 以及玻璃目录的 CC0 声明继续有效。
