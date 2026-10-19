# 模型、接口与算法约定

## 数据模型

项目支持 schema_version=1/2/3，机械边缘至少 v2，目标像高与逐视场保护至少 v3；单位为 mm、rad、nm。光线沿 +Z 传播，场角位于 YZ 子午面。第一表面顶点 Z=0，后续顶点累加 thickness；最后一个 thickness 是到像面的距离。曲率 c=1/R，正曲率表示球心位于顶点的 +Z 侧。平面 c=0。stop 是从零开始的表面索引，光阑可与折射面重合。

表面材料为“该面之后的介质”；入射介质固定为 n=1。semi_aperture 为圆形有效半径。asphere 顺序为 A4,A6,A8,A10；矢高为 `c*r²/(1+sqrt(1-(1+K)c²r²)) + Σ A(2j)*r^(2j)`。

object_distance=null 表示无限远，否则是从第一顶点到物面的正距离。有限物点为 `(0,-distance*tan(field),-distance)`。射线起点选在第一面所有采样矢高之前，迭代调整发射高度瞄准光阑坐标。

Sellmeier 使用 `n²=1+Σ B_i*λ²/(λ²-C_i)`，λ 使用 µm。系数保存为 `[[B1,B2,B3],[C1,C2,C3]]`。材料可使用常数 n；所有材料带有效波段和来源。

JSON 使用 round-trip 浮点解析；不支持的 schema 明确拒绝。CSV 第一行 `#oos=<项目元数据 JSON>` 保存材料和分析设置，后续是处方表。它是 OSS 自有交换格式，不是 Zemax/Code V 格式。

## 计算接口

Rust `execute(Request, &AtomicBool)` 返回 JSON 或明确错误。CLI `--request` 读取 stdin JSON，正常结果写 stdout，错误写 stderr 并返回非零退出码。

```json
{
  "operation": "analyze",
  "project": "此处为完整项目对象，不是文件路径",
  "sampling": 25,
  "diffraction": false
}
```

操作：`validate` 返回诊断数组；`trace`/`analyze` 返回近轴参数、光线、点列图、多色场摘要与诊断；`autofocus` 返回候选；`optimize` 另接收 variables 与 target_efl；`preview` 接收 pattern=`grid|resolution|points`。

0.7 光线新增 `stage=aiming|trace` 与 `aiming` 元数据（目标坐标、残差、迭代数、方法、失败原因及试算终止信息）；瞄准失败为 `status=aiming_failed`、`points=[]`。物理终止面的索引从零开始。每个 Spot 的 `failures` 按阶段/状态/面/原因合并，数量之和严格等于 `failed`。错误通道支持 JSON 字符串 `code=virtual_image|ray_failure|ray_failures`，界面统一翻译并保留逐视场、波长和数量；兼容旧字符串错误。

```json
{
  "variables": [
    {"kind":"curvature","surface":1},
    {"kind":"thickness","surface":2},
    {"kind":"asphere","surface":1,"coefficient":0}
  ],
  "target_efl": 50
}
```

界面使用 Tauri `compute(job,request)`；任务在工作线程执行，`cancel(job)` 置取消标志。每行瞳采样、每次优化迭代和每行预览检查取消。同一控制器的新计算显式取消自己的旧任务；不同面板可独立运行，后台预览不取消扫描/对比。前端修订号与 AbortController 阻止陈旧结果覆盖。任务阶段为开始/结束，UI 额外显示预览/精细计算，不伪造百分比。桌面 open_project/save_project 通过原生对话框选择路径；保存先写同目录临时文件并 sync，再原子替换。取消对话框不写入文件。

## 数值方法

0.8 新增光圈/目标/镜组接口及工作区字段，详见 [0.8 工作流](DESIGN_WORKFLOWS.md)。`aperture_scan` 的 `aperture_options` 为 `{f_numbers,refocus,sampling,mtf}`；`stop_map` 复用 `sampling`、`wave_options.field_index/wavelength_nm`；`move_group` 接收 `group_move={start,end,delta_mm}`，索引从零开始；`checks` 接收 `constraints`。`constraints.design` 可选 `{f_number,f_tolerance,min_bfl_mm,max_front_diameter_mm}`，缺省保持旧行为。优化变量增加仅限光阑面的 `kind=aperture`。UI 以稳定排序后的光学字段识别扫描源模型，避免跨语言序列化顺序误判过期。工作区新增 `aperture`、`aperture_scan`、`groups`；命名版本可带 `groups`，这些元数据不参与光学核心计算。

- 近轴光线采用 `[高度,n*倾角]` 矩阵，算有效焦距、后焦距、入瞳/出瞳共轭和放大率。系统无光焦度或瞳在无限远时返回 null。
- 顺序追迹采用矢高方程的 Newton 求交，步长限制 100 mm、最多 60 次、残差容差 1e-10 mm。非球面超出定义域、迭代失败分别诊断。
- 精确向量 Snell 折射累计光程；全反射在此顺序透射模型中终止，不追踪反射分支。
- 0.7 瞄准缓存每视场/波长的主光线，采用近轴初值、二维有限差分 Jacobian、限步与回溯 Newton；目标失败时沿主光线分 8 步延拓，检查相对主光线 Jacobian 的翻转。瞄准阶段忽略上游口径，成功后重新追迹并检查全部口径。该方法不是任意折叠瞳全部解的证明。
- 圆盘内规则方格等权采样。每个波长的 RMS 关于自身质心；多色 RMS 使用共同质心，包含横向色差。全无有效光线时返回 null。遮挡比例以发射样本数为分母，不是照度。
- 场曲/像散使用 d 线主光线附近微分光束的弧矢/子午交点。纵向色差报告无限远近轴 BFL 对 d 线的差值。畸变仅在无限远采用 `100*(chief_y/(EFL*tan(field))-1)`。
- 自动对焦在当前像距的 0.2–3 倍附近搜索 RMS 最低像面，正近轴后焦距可扩大初始搜索范围；上下限至少 0.01/20 mm。无限远负后焦距明确拒绝后方实像自动对焦。38 次三分搜索，使用 9×9 网格；不能对所有可能焦点提供无界搜索保证。
- 局部优化采用有限差分 Jacobian 与阻尼最小二乘，默认 25 次迭代、最多 100 次、12 个活动变量。0.4 光斑残差按 0.01 mm 归一化，焦距按用户容差归一化，总长与最小厚度/空气间隔使用无量纲违规惩罚。拒绝无效几何与任何失败采样光线；最终再做 33×33 口径检查。0.3 的相交检查采用分段导数区间界限；表格最薄厚度是采样估计，不是制造可行性认证。

## 衍射与局部成像（0.2.0）

具体算法、质量门槛、尺度和限制见 [衍射说明](DIFFRACTION.md)。新增操作：

```json
{
  "operation": "wave",
  "project": "完整项目对象",
  "wave_options": {
    "field_index": 0,
    "wavelength_nm": null,
    "max_pupil_samples": 256
  }
}
```

`wavelength_nm=null` 使用所有配置波长及权重；填写数值为单色。采样上限只接受 128 或 256。返回 `bands`、`quality`、完整单位能量 PSF、弧矢/子午 MTF、像素/频率间距、参考像点和模型说明。不收敛或不适用返回错误。

`preview` 接收同样的 `wave_options`，依次计算全部配置视场（忽略 options 中的 field_index），输出成功的 frames 及各视场 failures；取消则终止整个任务。`pattern=grid|resolution|points`。

`pupil` 导出指定单色的规则参考球面 OPD 和发射坐标，sampling 为 16–256，默认波长 587.5618 nm。`pupils` 按生产计算的公共像面间距导出所有指定波长的瞳数据，sampling 只接受 64/128/256。这两个是复算诊断接口，没有收敛保证。

兼容旧的 `analyze` + `diffraction=true` 调用时，结果仍存于历史字段 `experimental_wave`，但使用新的带门槛实现；新 UI 使用独立的 `wave` 操作。场角和波长不会静默截断到合法值。

## 机械模型与空白文档（0.3.0）

参见 [MECHANICS.md](MECHANICS.md)。新增 geometry 操作返回 spans（表面索引、轴上厚度、共同边缘厚度、采样最小值、检查半径、分离状态）及 diagnostics。validate 接受结构有效的空白项目；光学分析入口通过 validate_optical 拒绝空白处方。机械字段不进入求交、折射、瞳采样或衍射公式。


## 0.4 工作流接口

`focus_scan` 接受 `focus_options={min_mm,max_mm,steps,sampling,criterion}`，criterion 为 `center` 或 `balanced`。中心准则必须有 0 rad 视场；两种准则均排除任一配置视场存在失败/遮挡的扫描位置。返回每视场多色 RMS、失败计数、离散推荐点与边界标记。

`optimize` 可传 `constraints={target_efl_mm,efl_tolerance_mm,max_length_mm,min_center_mm,min_edge_mm,min_air_mm}`；此时替代旧 `target_efl`。返回 accepted、checks、sampling=33；未满足约束返回不可采纳候选，密集通光失败则返回错误。材料固定，最多 12 个变量、25 次局部 DLS 迭代，候选不保证全局最优或 RMS 必然降低。

项目的可选 `workspace` 为文档层扩展，独立 `schema_version=1`，保存 `versions`、成功扫描设置 `focus` 与当前 `constraints`。每个版本只包含 `prescription`，禁止嵌套版本历史；最多 20 个版本且总文件不超过 4 MB。Rust Project 支持光学 v1/v2/v3 模型，界面调用引擎前移除 workspace，候选采纳与版本恢复保留当前工作区。原生文档命令按文本原子保存全部字段。CSV 的 #oos 元数据同样携带 workspace。

对比不复用缓存分析。A/B 均使用相同的 33×33 几何采样；配置不同时须在 UI 明确启用临时对齐，复制 A 的视场、波长及权重、物距和传感器设置，处方不改写。点列图共享物理范围；MTF 共享 lp/mm 轴；PSF 以各自物理间距转换为强度密度并双线性显示到共同 µm 视窗，亮度共用两者的最大密度。

## 0.6 优化设置与进度

`optimize` 增加可选 `optimization`；提供时须同时提供 `constraints`，替代旧的平面 `variables`：

```json
{
  "optimization": {
    "variables": [
      {"variable":{"kind":"curvature","surface":1},"min":0.01,"max":0.03,"locked":true},
      {"variable":{"kind":"thickness","surface":2},"min":40,"max":60,"locked":false}
    ],
    "preset":"balanced",
    "max_iterations":25
  }
}
```

边界可为 null（无限制），有限差分在边界处使用向内方向；每个试步投影到边界。锁定行不进入 Jacobian。`preset=center|balanced|edge` 的具体权重见 [OPTIMIZATION.md](OPTIMIZATION.md)。旧请求仍采用默认均衡、25 次设置。

候选增加 `report`，包含实际权重、原始/候选逐视场和加权 RMS、变量设置、全部迭代轨迹和停止原因；`checks` 增加可选 `reason`，覆盖用户边界、连续几何和最终密集采样通光。最终密集采样存在部分失败但仍有可计算 RMS 时，返回带失败计数且 `accepted=false` 的候选；无法得到 RMS 时返回错误。引擎批准与所有检查通过共同决定前端采纳。

Rust `execute_with_progress` 提供回调；普通 `execute` 保持原接口并丢弃进度。Tauri 按 job 发出 `optimization-progress` 事件，前端按 job/revision/取消信号过滤。开发桥接通过 `oos-cli --request-progress` 输出 NDJSON，每行 `{"progress":...}`，最后 `{"result":...}`；旧 `--request` 保持单个 JSON。浏览器读取流式响应；取消会关闭连接并结束对应 CLI。

文档 `workspace.optimization` 保存变量表和预设，版本行新增 `analysis_preset`。它们不会进入光学模型。真实玻璃快照仍使用原有 `Material` 结构，内置数据与再生成脚本见 `src/data/glass-catalog.json` 和 `scripts/import_glass_catalog.py`。


## 1.0 界面、帮助与技术图纸

光学核心与 0.9 算法保持一致。导航表 `src/navigation.ts` 明确维护四组和 14 个工具；右侧基础/专业模型保留，优化编辑器移到中央。内置 20 篇 `docs/manual/*.md` 通过 Vite raw 导入，以纯文本组件渲染，支持 NFKC 归一化、空格分词 AND 全文检索、结果摘要与匹配高亮；不执行文档 HTML。`scripts/build_manual.mjs` 生成可独立打开、无网络依赖的 HTML / Markdown 完整手册。

`DrawingPanel` 冻结当前完整项目、时间和 UTF-8 JSON SHA-256，再请求 geometry / field_plan / analyze(sampling=33)。可选 wave 逐视场使用统一 method、当前像面、全部波长和 256 上限；没有自动重新对焦。失败保留诊断，绝不引用旧分析。编辑或离开面板中止任务；取消不会写文件。

`drawingWorker.ts` 在独立工作线程生成 A4 横向 PDF。矢高与方边环带调用同一前端轮廓函数，包含精确口径转折点；总图及逐片图为矢量，PSF 为灰度图。无定义域的表面省略曲线并标记，不画替代曲面。表格分页重复标题，长单元格继续分页，显示数值允许舍入；源文件附件保留原始精度。

PDF 生成时注册 fontkit，使用静态 regular Noto Sans SC，仅嵌入实际字形。少数未收录字符以问号显示，附件原文保持不变。`project.oos.json` 附件完整携带工作区、版本和扫描源，首页哈希对应附件字节；`analysis.json` 带实际配置与摘要，省略大型 rays/spot points/PSF 数组。

Tauri 新命令 `save_pdf(name,bytes)` 只接受 PDF 签名、最大 32 MB，通过原生保存对话框明确选址，并沿用同目录临时文件、sync、原子替换。浏览器开发桥接则下载 Blob，不需要虚拟打印机。打包资源包含全部手册、字体许可和来源；WebView CSP 允许本机 worker 和同源字体，不引入远程脚本。

PDF 是名义设计记录，不生成未指定的加工公差、倒角、装配基准、镀膜或机械强度结论。历史记录明确归属于其源处方，不能当作本次实际验证。1.0 验收证据见 TEST_REPORT.md 与 validation-pdf-1.0.json。
