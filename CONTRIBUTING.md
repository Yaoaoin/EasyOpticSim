# 参与 EasyOpticSim / Contributing

欢迎提交可复现的问题、教程改进、独立光学参考算例和代码。可以使用中文或英文。项目由个人维护，不承诺固定响应时间。

## 先选择合适的入口

- 使用问题先查看 [新手教程](docs/manual/start.md)、[完整手册](docs/EasyOpticSim-Y1.1-使用手册.md)和[已知范围](docs/STATUS.md)。
- 界面、文件或安装错误使用 Bug 模板；计算结果疑问使用“光学计算问题”模板。
- 新功能请说明实际使用场景和预期结果。较大的算法、格式或界面改动先通过 Issue 讨论范围。
- 安全漏洞按 [SECURITY.md](SECURITY.md)报告，不在公开 Issue 中贴出利用细节。

附件只包含你有权公开的处方和图片。删除客户设计、私人路径和个人信息；示例越小越容易复现。报告数值问题时保留单位、波长、视场、采样、像面和对焦条件。

## Windows 开发环境

- Node.js 24、pnpm 11.25.0。
- Rust stable（本地 1.0 验证环境为 1.99.1），MSVC 工具链。
- Visual Studio C++ Build Tools、Windows SDK，以及桌面调试需要的 WebView2 Runtime。
- Python 3.12 仅用于独立验证；运行软件不需要 Python。

在项目根目录执行：

```powershell
pnpm install --frozen-lockfile
cargo build -p easyopticsim-cli --locked
pnpm dev
```

开发界面地址为 `http://127.0.0.1:1420/`，由 Vite 启动本机 CLI 桥接。原生桌面调试使用 `pnpm tauri dev`。静态托管 `dist` 不会提供光学引擎；不要把开发服务器暴露到公网。

## 修改与验证

从当前 `main` 创建工作分支。保持一次 PR 解决一个明确问题，不提交 `target`、`node_modules`、`output`、密钥或本机工具。

常规检查：

```powershell
pnpm test
pnpm build
cargo test --workspace --locked --release
cargo clippy --workspace --all-targets --locked -- -D warnings
```

仅改文档时检查链接和生成手册即可，不要求重新运行全部光学验证。`docs/manual/*.md` 是完整手册的来源；运行 `pnpm manual:build` 更新合并 HTML / Markdown。

修改光学算法、模型、优化或保存格式时，还要增加能暴露原问题的测试，并按相关范围运行独立验证：

```powershell
python -m venv .tools/validation
.tools/validation/Scripts/python -m pip install -r scripts/requirements-validation.txt
cargo build -p easyopticsim-cli --locked --release
.tools/validation/Scripts/python scripts/validate_rayoptics.py
.tools/validation/Scripts/python scripts/validate_saved_design.py
.tools/validation/Scripts/python scripts/validate_coverage.py
```

其余验证脚本见 [测试报告](docs/TEST_REPORT.md)和[发布流程](docs/RELEASING.md)。独立参考必须对齐材料、符号、物距、瞳采样、视场和像面；不要只更新期望值来消除失败。失败光线不能作为零误差或零能量冒充正常结果。

PDF 验证另需 `scripts/requirements-pdf-validation.txt` 和 Poppler 的 `pdftoppm`（放入 PATH 或设置 `OOS_PDFTOPPM`），不依赖任何特定编辑器或 AI 工具环境。

准备对外分发时用 `pnpm release:build`，它对 Rust 与 MSVC 嵌入的本机路径做映射并重新测试；普通本地构建可能含个人缓存 / PDB 路径。用 `python scripts/stage_release.py` 整理资产并再次检查。详见 [发布流程](docs/RELEASING.md)。

## 提交 PR

说明原问题、最终行为、验证命令及尚未验证的范围。涉及 UI 时提供前后截图；涉及数值时附参考来源、误差、单位和采样收敛；涉及文件格式时检查旧项目读取和保存重开。

新增依赖、材料、字体、图片或处方必须同时提交来源与再分发许可。更新依赖锁文件后，运行 `python scripts/notices.py` 并复核 [许可审查](docs/THIRD_PARTY_AUDIT.md)。不要移除上游版权与署名。

项目原创贡献按 Apache-2.0 接收；第三方内容保留原许可证。提交贡献表示你有权提供这些内容。当前不要求单独签署 CLA。

English contributions are welcome. Include a minimal reproduction, units and analysis settings, relevant tests, and the provenance/license of any new third-party content.
