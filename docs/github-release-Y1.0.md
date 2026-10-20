# GitHub Release：OpenOpticSim Y1.0

> 发布标题：`OpenOpticSim Y1.0 · 冰川体验版`  
> 标签：`Y1.0`  
> Target：发布时选择已通过 CI 的提交  
> 预发布：如发布前未完成干净 Windows 安装、升级和卸载验收，请勾选 Pre-release

OpenOpticSim Y1.0 让第一次接触光学设计的人也能开始。它在 Ayr1k 原始 OpenOpticSim 1.1 功能集上增加三步新建向导、简单/专业双模式、四步任务导航和冰川蓝玻璃界面；Rust 光学核心、项目格式和专业工具保持兼容。

## 你会看到什么

- 选择“拍人像、拍风景、拍远处、拍近物”，自动建立正式设计目标。
- 跟着“想拍什么、搭建镜头、让画面更好、检查与保存”完成第一次设计。
- 一键切换专业模式，继续使用全部十五个工作区工具。
- 全新的冰川蓝玻璃主题，包含透明度降级、清晰状态色和键盘焦点。
- 旧 `.oos.json` / CSV 项目继续读取，简单模式不会使用另一套计算结果。

## 下载

普通 Windows x64 用户下载：

- `OpenOpticSim_1.1.0-y1.0_x64-setup.exe`
- `OpenOpticSim_1.1.0-y1.0_x64-setup.exe.sha256`

在 PowerShell 校验：

```powershell
Get-FileHash .\OpenOpticSim_1.1.0-y1.0_x64-setup.exe -Algorithm SHA256
Get-Content .\OpenOpticSim_1.1.0-y1.0_x64-setup.exe.sha256
```

两个 SHA-256 值必须完全一致。源码 ZIP 面向开发者，普通使用请选择安装程序。

本次构建的安装包 SHA-256：`18b4f62fcddab11aa8bcb451c826db7d275741e0a3c08003bba5610aad28b328`。

## 升级提示

- 升级前备份自己的 `.oos.json` 项目。
- Y1.0 默认进入简单模式；原版用户可在顶部切换“专业”。
- 用途预设代表目标，不保证示例处方已经达到目标；请查看实际检查结果。
- 安装程序未签名，Windows 可能显示来源提示。请只从本仓库 Release 下载并核对校验值。

## 验证状态

- 前端：11 个测试文件、62 项测试通过。
- TypeScript、离线手册和 Vite 生产构建通过。
- Rust 全工作区：81 项 release 测试通过；Clippy 严格警告检查通过。
- Windows x64：Tauri 桌面程序、CLI 和 NSIS 安装包构建通过。
- 36 项内置资源一致性检查通过；桌面程序和 CLI 的个人主目录路径命中均为 0。
- 尚未完成：干净 Windows 断网安装、升级和卸载验收；安装包未签名。

若以上干净系统验收尚未完成，建议本 Release 保持 Pre-release，并保留上述未完成项目说明。

## 兼容范围与限制

Y1.0 不扩展原光学算法的适用范围。软件仍面向可见光、旋转对称、顺序折射和局部平面成像；PSF/MTF、有限物距、机械检查及大视场能力以仓库 `STATUS.md`、`COVERAGE.md` 和验证记录为准。技术图纸不会自动补造加工公差、镀膜、表面质量或装配基准。

## 开源许可与致谢

本版本是 [Yaoaoin/OpenOpticSim](https://github.com/Yaoaoin/OpenOpticSim) 对 [Ayr1k/OpenOpticSim](https://github.com/ayr1k/OpenOpticSim) 的 fork 迭代。代码继续依据 Apache License 2.0 分发；上游版权、`NOTICE`、第三方许可、字体 OFL 和玻璃目录 CC0 来源均保留。感谢 Ayr1k 和所有 OpenOpticSim contributors。

完整说明：[Y1.0 版本说明](https://github.com/Yaoaoin/OpenOpticSim/blob/Y1.0/docs/releases/Y1.0.md) · [更新日志](https://github.com/Yaoaoin/OpenOpticSim/blob/Y1.0/CHANGELOG.md) · [问题反馈](https://github.com/Yaoaoin/OpenOpticSim/issues)
