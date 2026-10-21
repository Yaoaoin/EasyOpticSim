# GitHub Release：EasyOpticSim Y1.2

> 发布标题：`EasyOpticSim Y1.2 · 引导设计与独立复核助手`  
> 标签：`Y1.2`  
> Target：选择包含 Y1.2 版本文件并通过 CI 的最终提交  
> 预发布：如未完成干净 Windows 安装、升级与卸载验收，请勾选 Pre-release

EasyOpticSim Y1.2 正式加入三入口引导设计、六步新建向导和独立复核设计助手。本版基于 Ayr1k 贡献并合并的 [PR #1](https://github.com/Yaoaoin/EasyOpticSim/pull/1)，继续保留 Ayr1k/OpenOpticSim 的 Apache-2.0 许可证、NOTICE、版权与第三方声明。

## 本版亮点

- 新手只需跟随「我的目标 → 画面与改进 → 检查与保存」。
- 六步新建向导会先说明模板限制并运行基础检查；跳过或未达标会明确标为实验草稿。
- 设计助手可按全画面、中心或边缘优先尝试对焦和有限参数优化。
- 候选采用 65×65 几何采样逐视场复核，不允许画质退步或增加遮挡。
- 候选所有画面位置执行最高 128 瞳采样的衍射检查并要求收敛。
- 助手尊重变量锁定和边界，不自动换材料、改画幅、扩大口径或放宽目标。
- 所有改进仍需用户查看差异并确认采纳；找不到合格候选时原设计保持不变。
- 一键体检扩展到全部画面位置并纳入正式设计目标检查。

## 下载

普通 Windows x64 用户下载：

- `EasyOpticSim_1.1.0-y1.2_x64-setup.exe`
- `EasyOpticSim_1.1.0-y1.2_x64-setup.exe.sha256`

在 PowerShell 中校验：

```powershell
Get-FileHash .\EasyOpticSim_1.1.0-y1.2_x64-setup.exe -Algorithm SHA256
Get-Content .\EasyOpticSim_1.1.0-y1.2_x64-setup.exe.sha256
```

两个 SHA-256 值必须完全一致。本次安装包 SHA-256：

`2cdbdab56bc271416bb907ffce359d25d3a1f8010429921d4fde2c6726b493aa`

安装包未签名，Windows 可能显示来源提示；请只从本仓库 Release 下载。

## 升级与兼容

- 升级前备份自己的 `.eos.json` 或 `.oos.json`。
- Y1.2 继续读取旧 EasyOpticSim/OpenOpticSim 项目，新保存文件默认使用 `.eos.json`。
- Y1.1 的自动恢复键、光学 schema、计算核心、版本记录和高级工作区保持兼容。
- 新建项目现在会清除模板携带的旧版本与不适用优化变量，再写入用户目标。

## 验证状态

- 前端与助手：14 个测试文件、82 项测试通过。
- 真实 Rust 引擎助手集成测试通过。
- Rust 全工作区：81 项 release 测试通过。
- TypeScript、22 章离线手册与 Vite 生产构建通过；1671 个模块完成转换。
- Clippy 全工作区、全部目标严格警告检查通过。
- EasyOpticSim 桌面程序、CLI 和 Windows x64 NSIS 安装包构建通过。
- 两个发布二进制的个人主目录路径命中均为 0。
- 安装包大小：225,329,258 字节，约 214.89 MiB。
- 尚未完成：代码签名，以及干净 Windows 的断网安装、升级和卸载验收。

## 范围与限制

助手优化的“改善”指当前条件下的几何光点 RMS 改善，不保证所有 MTF 空间频率同时改善。体检和候选通过也不代表加工公差、镀膜、杂散光、机械强度、装配或真实相机系统已经认证。Y1.2 不提供全局结构搜索、自动选玻璃或自动生成镜头结构。

## 开源许可与致谢

EasyOpticSim 是 [Yaoaoin/EasyOpticSim](https://github.com/Yaoaoin/EasyOpticSim) 对 [Ayr1k/OpenOpticSim](https://github.com/ayr1k/OpenOpticSim) 的 fork 迭代。感谢 Ayr1k 提交 Y1.2 引导工作流，也感谢所有 OpenOpticSim contributors。代码继续依据 Apache License 2.0 分发；上游版权、`NOTICE`、第三方许可、字体 OFL 和玻璃目录 CC0 声明均保留。

完整说明：[Y1.2 版本说明](https://github.com/Yaoaoin/EasyOpticSim/blob/Y1.2/docs/releases/Y1.2.md) · [更新日志](https://github.com/Yaoaoin/EasyOpticSim/blob/Y1.2/CHANGELOG.md) · [问题反馈](https://github.com/Yaoaoin/EasyOpticSim/issues)
