# EasyOpticSim Y1.2

面向摄影与镜头爱好者的本地光学设计工作室。EasyOpticSim 使用 React、Tauri 2 和 Rust，将复杂的镜头设计、调校和检验整理成新手也能跟随的流程；Windows x64 是主要发布平台。

当前用户版本为 **Y1.2**，内部语义版本为 `1.1.0-y1.2`。当前仓库：[Yaoaoin/EasyOpticSim](https://github.com/Yaoaoin/EasyOpticSim)。本项目由 [Ayr1k/OpenOpticSim](https://github.com/ayr1k/OpenOpticSim) fork 并继续开发，保留原项目 Apache License 2.0、版权声明、[NOTICE](NOTICE) 和全部[第三方许可](THIRD_PARTY_NOTICES.txt)。项目改名不改变上游代码的许可证或归属。

Y1.2 合并了 Ayr1k 贡献的引导式 EOS 设计工作流和独立复核助手，并在 EasyOpticSim 发布体系中完成版本、文档、测试和安装包集成。详细设计与自动化边界见 [Y1.2 引导设计与验证助手](docs/EOS-GUIDED-DEVELOPMENT.md)。

## Y1.2 新功能

- 三入口引导工作区：用“我的目标 → 画面与改进 → 检查与保存”替代新手面对的完整专业工具树；高级工作区仍完整保留。
- 六步新建向导：选择用途、画幅和距离，设置焦距/F 数目标，确认模板边界，运行 33×33 基础检查后再创建项目；跳过或未达标会明确标记为实验草稿。
- 独立复核设计助手：先检查结构和通光，再按全画面、中心或边缘优先尝试对焦和受约束优化。
- 严格候选门槛：使用 65×65 几何采样逐视场比较，不允许画质退步或以增加遮挡换取 RMS；复核锁定、变量边界、结构、覆盖和全部设计目标。
- 精细衍射复核：候选的每个画面位置最多使用 128 瞳采样，要求衍射计算报告收敛；没有合格方案时保留原设计。
- 统一模板来源：人像、风景、长焦、近物使用稳定 ID 与明确示例文件绑定，保留模板真实材料和波谱，并清除不适用的旧工作区状态。
- 一键体检增强：覆盖所有已分析画面位置，加入目标约束结果，并在项目变化、取消或离开时阻止旧结果回填。

Y1.1 的一键体检、安全候选机制、首次教程、`.eos.json` 文件格式和冰川蓝玻璃界面全部保留。完整内容见 [Y1.2 版本说明](docs/releases/Y1.2.md)、[更新日志](CHANGELOG.md)与 [GitHub Release 文案](docs/github-release-Y1.2.md)。

## 下载

发布后可从 Y1.2 Release 下载：

- [Windows x64 安装包](https://github.com/Yaoaoin/EasyOpticSim/releases/download/Y1.2/EasyOpticSim_1.1.0-y1.2_x64-setup.exe)
- [安装包 SHA-256](https://github.com/Yaoaoin/EasyOpticSim/releases/download/Y1.2/EasyOpticSim_1.1.0-y1.2_x64-setup.exe.sha256)
- [Y1.2 发布页](https://github.com/Yaoaoin/EasyOpticSim/releases/tag/Y1.2)

安装包包含离线 WebView2 组件、中文字体、完整手册、示例和许可文件。普通用户不需要安装 Node.js、Python 或 Rust。安装包目前未签名；请仅从本仓库下载并核对 SHA-256。

## 三分钟开始

1. 点击“新建项目”，选择人像、风景、远摄或近物。
2. 在六步向导中设置画幅、距离、目标焦距与 F 数，并运行基础检查。
3. 进入“画面与改进”，选择全画面、中心或边缘优先。
4. 让助手生成并独立复核候选，查看逐视场前后差异后再决定是否采纳。
5. 打开“检查与保存 → 一键镜头体检”，处理未通过项目。
6. 保存 `.eos.json`，或导出体检报告与技术图纸。

第一次启动会显示五步界面引导；顶部“跟我做”可重新打开。软件内帮助、F1 或 Ctrl+K 可检索说明。也可直接阅读 [EasyOpticSim Y1.2 完整手册](docs/EasyOpticSim-Y1.2-使用手册.md)、[离线 HTML 手册](docs/EasyOpticSim-Y1.2-使用手册.html)、[引导助手说明](docs/EOS-GUIDED-DEVELOPMENT.md)和[一键体检说明](docs/manual/health.md)。

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
