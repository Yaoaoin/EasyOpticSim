# EOS 引导设计与开发分支

本轮为 `yukibranch` 上的开发改进，尚未创建新的发行版本。

## 使用新流程

OOS 提供全面服务和专业框架。EOS 可以限制默认操作范围，但保留严谨的光学模型，并提供易理解的结果与面向常见场景的自动修正。

1. 选择「引导设计」，工作区只保留「我的目标」「画面与改进」「检查与保存」三个主入口。
2. 新建项目：选择用途、画幅和拍摄距离，设置目标，确认模板限制，执行基础检查，再创建。未检查或未达标的起点明确标为实验草稿。
3. 「我的目标」区分目标与当前焦距、光圈。更多条件可展开精确设置。
4. 「画面与改进」展示逐视场光点 RMS、采样、画幅、距离与波长。
5. 选择全画面、中心或边缘优先，点击「检查并尝试改进」。助手先诊断结构与通光，再尝试对焦和受约束优化。
6. 通过复核后查看前后差异及修改的参数，点击「查看候选与采纳条件」，最后在候选卡片中确认采纳。可以撤销。
7. 运行完整体检并保存 `.eos.json`。缺失检查、目标未满足、衍射未收敛都会保留说明。

「更多工具」保留镜片编辑、光点分布、测试图成像、精细画质、对焦与光圈扫描、版本和图纸。「高级工作区」保留完整参数控制。

## 自动化与精确性

- 模板使用稳定 ID 与明确文件绑定，保留真实材料和波谱。
- 新项目清除旧版本和旧优化变量，保留模板已有结构限制，并记录用户目标。
- 默认助手最多选择五个非光阑曲面的曲率和最后像距；已有变量表、锁定和边界继续生效。
- 显式配置中未开放像距时，跳过自动对焦与阶段间重对焦；最终再次核对锁定和边界。
- 不自动修改材料、画幅、波长或目标。已有口径、非球面等高级变量配置会被遵守。
- 对焦只能作为通过引擎约束的中间起点。优化失败时仍可复核对焦候选。
- 原始处方与候选都用 65×65 几何采样比较。逐视场不允许退步，不能通过增加遮挡获得更小的 RMS。
- 复核设计约束、连续结构检查与原有画质底线；候选所有视场执行最高 128 瞳采样的衍射检查，要求引擎报告收敛。
- 传感器模式下，画幅覆盖缺失或失败会阻止助手采纳。
- 取消计算、改变项目或退出页面后不回填旧结果。

改善指标是几何光点 RMS，不意味着所有空间频率的 MTF 改善。有限采样及收敛判据不是制造、公差、杂散光或真实相机认证。本轮没有新增全局搜索、自动选玻璃或自动生成结构；没有可验证的改进时明确停止。

## 本地运行

```powershell
git switch yukibranch
pnpm install --frozen-lockfile
cargo build -p easyopticsim-cli --locked
pnpm dev
```

默认端口 1420 被占用时可运行 `pnpm dev --port 1421`。不同端口使用独立浏览器存储。

常规检查：`pnpm test`、`pnpm build`、`cargo test -p easyoptics --locked --release`。
真实引擎集成测试：先构建 CLI，再在 PowerShell 设置 `$env:EOS_ENGINE_TEST = '1'` 并运行 `pnpm test`。该测试将长焦示例的像面移开 2 mm，要求助手恢复有效候选并完成独立几何与衍射复核。默认测试会跳过这一项，以免要求所有前端开发环境安装 Rust。

## 分支与同步

- `master`：OOS 开发线。
- `yukibranch`：EOS 开发线，实际名称全小写。
- `origin`：`ayr1k/OpenOpticSim`。
- `easy`：`Yaoaoin/EasyOpticSim`，目标分支为 `master`。

切换前先提交或暂存修改。`fetch` 只更新远程引用，不会自动合并代码：

```powershell
git switch yukibranch
git fetch easy
git log --oneline HEAD..easy/master
git merge easy/master
```

有冲突时先解决并提交。不要将 OOS 的 `origin/master` 当作 EOS 的同步来源。

## 发布分支

用 `git status` 检查是否还有未提交修改。本轮已提交的内容不需要重复提交；自己的新修改先审核并提交，再发布：

```powershell
git push -u origin yukibranch
```

这只发布 OOS 仓库里的 EOS 开发分支，不改变 OOS `master`。`-u` 会将跟踪目标改成 `origin/yukibranch`，方便 Desktop 后续推送；同步 EOS 仍显式使用 `git fetch easy` 与 `git merge easy/master`。

## GitHub 网页创建 PR

1. 完成推送，打开 `Yaoaoin/EasyOpticSim` → Pull requests → New pull request。
2. 点击 **compare across forks**。
3. 目标：**base repository = Yaoaoin/EasyOpticSim**，**base = master**。
4. 来源：**head repository = ayr1k/OpenOpticSim**，**compare = yukibranch**。
5. 检查 Files changed，填写标题、变更说明、测试结果，创建 PR。

这依赖两个仓库位于同一 GitHub fork 网络。若无法选择来源仓库，须使用该网络内具有写权限的 fork 或 EOS 开发分支。

## GitHub Desktop 创建 PR

1. File → Add local repository 添加本地仓库，Current Branch 选择 `yukibranch`。
2. Changes 中检查并提交自己的新修改；已提交的本轮内容在 History 查看。
3. 本仓库有两个远程，首次发布建议执行上面的明确命令 `git push -u origin yukibranch`，之后使用 Push origin。
4. 使用 Preview Pull Request / Create Pull Request（或 Branch 菜单的对应入口）。
5. 浏览器中再次核对上述 base/head。Desktop 默认打开的目标可能是 OOS，须改为 EOS。
6. 后续继续在同一分支提交并推送，已有 PR 会更新。

参考：[从 fork 创建 PR](https://docs.github.com/en/pull-requests/how-tos/create-pull-requests/creating-a-pull-request-from-a-fork)、[Desktop 创建 PR](https://docs.github.com/en/desktop/working-with-your-remote-repository-on-github-or-github-enterprise/creating-an-issue-or-pull-request-from-github-desktop)。
