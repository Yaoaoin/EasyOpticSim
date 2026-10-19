# 1.0 第三方许可与资源审查

复核日期：2026-10-19。对象为当前锁文件、Windows x64 依赖、本地分发资源和待公开文件；不是其他平台或未来升级的结论，也不替代内容权利人的授权。

## 清单与生成方式

`Cargo.lock` / `pnpm-lock.yaml` 固定依赖。`scripts/notices.py` 从 Rust 元数据、已安装 pnpm 包和字体收集原有许可文本，保守包含构建 / 测试依赖。此次去重后为 **380 项：263 Cargo、116 npm、1 字体**；每项均有声明、源 URL 和许可文本或下述明确标识的补充记录。

```powershell
pnpm install --frozen-lockfile
cargo fetch --locked
python scripts/notices.py
```

工具从 PATH 查找 Cargo，按 Windows x64 收集；不依赖作者个人目录。pnpm 包从当前安装目录收集，升级或换平台后应重新审查，不能把本次清单当成所有平台的完整 SBOM。独立验证 Python 包只在开发环境安装，不进入安装包；其依赖安装与许可由各上游包保留，不包含在上述 380 项之中。

机器可读清单为 [dependencies.json](dependencies.json)，完整文本为 [THIRD_PARTY_NOTICES.txt](../THIRD_PARTY_NOTICES.txt)，补充来源见 [licenses/SOURCES.md](licenses/SOURCES.md)。检查到许可文本存在不等于自动履行了全部条款。

## 分发内容

| 内容 | 来源、许可与处理 |
| --- | --- |
| 原创代码、文档、教学处方、图标 | Apache-2.0；根目录 LICENSE / NOTICE。示例与用户自建模型变体见 [示例来源](../examples/README.md) |
| Rust / React / Tauri / PDF 等依赖 | 按锁文件保留上游 MIT、Apache、BSD、ISC、Unicode 等声明；完整文本随安装包提供。未更改第三方组件源文件 |
| MPL-2.0 组件 | cssparser 0.37.0、cssparser-macros 0.7.1、dtoa-short 0.3.5、option-ext 0.2.0、selectors 0.38.0；NOTICE 与逐项清单提供精确版本及可取得的源代码入口。不把这些组件重新许可为 Apache |
| Noto Sans SC | Google Fonts；SIL OFL 1.1；保留 Adobe 版权及保留名称声明。转换为 wght=400 静态实例、未删字形；使用 Noto Sans SC 名称，没有采用保留名称 Source。原始 / 当前哈希与转换见 [source.json](../src/assets/fonts/source.json)，原 OFL 随包提供 |
| 8 种 SCHOTT 玻璃子集 | 来自 refractiveindex.info CC0-1.0 快照；不是取得整个商品玻璃库的再许可。固定提交、每条数据源 URL、哈希、波段与引用保存在 [glass-catalog.json](../src/data/glass-catalog.json)，[CC0 原文](catalog/CC0-1.0.txt)随包提供 |
| caniuse-lite | 开发构建使用的 CC-BY-4.0 浏览器兼容数据；源为 caniuse.com（Alexis Deveria），包作者 Ben Briggs；NOTICE 保留署名，清单保留许可与链接，数据未修改 |
| RayOptics / NumPy / SciPy | 仅独立参考计算，非安装版引擎；保留版本和参考报告，不将上游实现伪称自研 |
| WebView2 Standalone Installer | 微软未修改的 Evergreen 运行时再分发组件；独立适用微软条款，不是 Apache-2.0 资源。使用 Tauri 官方离线安装模式，不把运行时二进制放入 Git |
| UI 截图与回归项目 | 本项目运行产生的界面 / 数据；已检查截图联系表与元数据。用户原始参考商品图、剪贴板附件和外部个人项目路径不在待提交文件中 |

许可依据：[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)、[OFL 1.1](https://openfontlicense.org/open-font-license-official-text/)、[数据源许可证](https://github.com/polyanskiy/refractiveindex.info-database/blob/main/LICENSE)、[WebView2 分发说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution)。数据的固定提交与本地许可一并保留；在线主分支仅作为上游入口，不替代固定快照。

## 两处上游独立许可文本缺失

1. **@pdf-lib/fontkit 1.1.1（运行时）**：npm 元数据及上游 README 声明 MIT，但包和 fork 未附独立 LICENSE。已有 `fontkit-attribution.txt` 保留 Andrew Dillon / Devon Govett 署名、声明和标准 MIT 条款，明确不是从上游取回的独立 LICENSE。升级时重新核对，不将该补充记录描述为完整上游文件。
2. **stackback 0.0.2（仅测试工具）**：npm 元数据声明 MIT 并列出 Roman Shtylman；包缺少独立 LICENSE，旧上游地址重定向到已归档的 [defunctzombie/node-stackback](https://github.com/defunctzombie/node-stackback)，该仓库也没有独立 LICENSE。新增 `stackback-attribution.txt` 保留元数据与标准条款，并标注证据边界，不编造版权年份。

这两项已作为可见例外记录；“0 项缺少文本记录”包含它们的补充记录，不等于上游打包缺失已消失。未发现需要把 OOS 原创代码整体更换许可证的依赖声明；后续新增、修改或升级仍需复核。

## 公开前仍需维护的事项

新增用户或第三方处方时核实提供者有权分发；提交来源不明确的商品处方前不能仅凭名称或网页可访问性判断授权。400 mm 系列按用户自行搭建并在本项目修正的模型记录，不宣称官方数据或商品性能。

公开版本必须同时分发 LICENSE、NOTICE、第三方声明、玻璃 CC0 与字体 OFL。源码公开不意味着 WebView2 或第三方字体改用 Apache。首次提交后应以发布标签记录源快照，并在对应安装包重建后重新核对声明哈希。
