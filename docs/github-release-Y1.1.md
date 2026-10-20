# GitHub Release：EasyOpticSim Y1.1

> 发布标题：`EasyOpticSim Y1.1 · 一键镜头体检`  
> 标签：`Y1.1`  
> Target：选择已通过 CI 的最终提交  
> 预发布：如未完成干净 Windows 安装、升级与卸载验收，请勾选 Pre-release

EasyOpticSim Y1.1 完成一键镜头体检、安全修复建议和新手跟做教程，并将当前 fork 的应用与发布名称从 OpenOpticSim 更新为 EasyOpticSim。原始 Ayr1k/OpenOpticSim 的 Apache-2.0 许可证、NOTICE、版权和第三方声明全部保留。

## 本版亮点

- 一次点击检查成像、通光、画质、机械和导出准备。
- 结果明确分为可以继续、建议改进、必须修复和尚未检查。
- 失败卡片可定位问题镜片，或生成自动对焦/优化候选。
- 自动修复不会静默修改处方；用户复核并确认后才采纳。
- 首次启动五步引导、工作区“跟我做”进度。
- 人像、广角、长焦、近物四类教学模板。
- 新文件使用 `.eos.json`，继续兼容 `.oos.json` 和 CSV。

## 下载

普通 Windows x64 用户下载：

- `EasyOpticSim_1.1.0-y1.1_x64-setup.exe`
- `EasyOpticSim_1.1.0-y1.1_x64-setup.exe.sha256`

在 PowerShell 中校验：

```powershell
Get-FileHash .\EasyOpticSim_1.1.0-y1.1_x64-setup.exe -Algorithm SHA256
Get-Content .\EasyOpticSim_1.1.0-y1.1_x64-setup.exe.sha256
```

两个 SHA-256 值必须完全一致。安装包未签名，Windows 可能显示来源提示；请只从本仓库 Release 下载。

本次安装包 SHA-256：`18bce9c8f63b1f591bbd9cc583aeb4ff84d51c4251660879a46f020bbf361649`。

## 升级与兼容

- 升级前备份自己的 `.oos.json` 或 `.eos.json`。
- Y1.1 会读取旧 OpenOpticSim 项目，新保存文件默认使用 `.eos.json`。
- 光学 schema 和计算核心保持兼容，简单/专业模式共享同一结果。
- 旧自动恢复键会在首次读取时兼容迁移。

## 验证状态

- 前端：12 个测试文件、66 项测试通过。
- Rust：全工作区 81 项 release 测试通过。
- TypeScript、22 章离线手册与 Vite 生产构建通过；1665 个模块完成转换。
- Clippy 全工作区、全部目标严格警告检查通过。
- EasyOpticSim 桌面程序、CLI 和 Windows x64 NSIS 安装包构建通过。
- 37 项内置资源一致性检查通过；两个发布二进制的个人主目录路径命中均为 0。
- 安装包大小：225,325,786 字节，约 214.89 MiB。
- 尚未完成：代码签名，以及干净 Windows 的断网安装、升级和卸载验收。

## 范围与限制

体检通过不代表加工公差、镀膜、杂散光、机械强度、装配或真实相机系统已认证。PSF/MTF、有限物距、大视场与机械检查仍以仓库 `STATUS.md`、`COVERAGE.md`、`DIFFRACTION.md` 和验证记录声明的范围为准。

## 开源许可与致谢

EasyOpticSim 是 [Yaoaoin/EasyOpticSim](https://github.com/Yaoaoin/EasyOpticSim) 对 [Ayr1k/OpenOpticSim](https://github.com/ayr1k/OpenOpticSim) 的 fork 迭代。代码继续依据 Apache License 2.0 分发；上游版权、`NOTICE`、第三方许可、字体 OFL 和玻璃目录 CC0 来源均保留。感谢 Ayr1k 和所有 OpenOpticSim contributors。

完整说明：[Y1.1 版本说明](https://github.com/Yaoaoin/EasyOpticSim/blob/Y1.1/docs/releases/Y1.1.md) · [更新日志](https://github.com/Yaoaoin/EasyOpticSim/blob/Y1.1/CHANGELOG.md) · [问题反馈](https://github.com/Yaoaoin/EasyOpticSim/issues)
