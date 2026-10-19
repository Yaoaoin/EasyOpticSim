const translations: Record<string, string> = {
  Blocked: "口径遮挡；部分光线未到达像面",
  Missed: "光线未命中有效表面，或未向前到达像面",
  TotalInternalReflection: "发生全反射；当前模型仅追踪透射路径",
  NonConvergent: "表面求交未收敛，请检查该面曲率、间隔和入射方向",
  InvalidMaterial: "所选波长超出材料定义，或折射率无效",
  AimingFailed: "光阑瞄准未找到稳定解；这不是已确认的口径遮挡",
  "Adjacent surfaces intersect; increase spacing or reduce aperture":
    "相邻表面相交，请增大间隔或缩小口径",
  "Surface sag is undefined at aperture edge": "口径边缘超出曲面的定义范围",
  "Invalid surface dimensions": "表面尺寸无效，请检查曲率、间隔与半口径",
  "Material invalid at selected wavelengths":
    "所选波长超出材料有效波段，或材料系数无效",
  "Candidate rejected: rays failed or clipped":
    "当前采样存在瞄准或物理追迹失败，请在“像差与通光”查看具体阶段和表面后修正模型",
  "Candidate rejected by dense final aperture verification":
    "候选未通过精细通光检查，已保留原设计",
  Cancelled: "计算已取消",
  "Center focus requires a zero-angle field":
    "中心优先需要配置 0° 视场，请调整分析设置或选择全视场折中。",
  "Focus scan: use 0.01 <= min < max <= 100000 mm, 3..101 steps and odd sampling 7..33":
    "扫描范围需满足 0.01 ≤ 起始像距 < 结束像距 ≤ 100000 mm；点数为 3–101 的整数，瞳采样为 7–33 的奇数。",
  "Invalid project": "项目参数无效，请先修正几何检查与材料诊断。",
  "Constraints require positive EFL, EFL tolerance and total length; nonnegative thickness and air gap":
    "目标焦距、焦距容差和总长必须为正数；厚度与空气间隔下限不能为负数。",
  "Lens mechanical radii must match; set the whole-lens diameter":
    "同一镜片两面的机械外径必须一致，请使用“机械外径”统一设置",
  "Add a lens before optical analysis": "请先添加镜片，再进行光学分析",
  "Mechanical radius must cover the clear aperture and be at most 10000 mm":
    "机械半径必须不小于有效半口径，且不超过 10000 mm",
  "Mechanical extension exceeds surface domain; use a flat annulus or reduce diameter":
    "机械曲面延伸超出定义范围，请改用平面环带或减小机械外径",
};
export const aimingReason = (reason: string | null | undefined) =>
  ({
    chief_unresolved:
      "主光线瞄准未找到稳定解；请检查前组光焦度、光阑位置和视场",
    singular_mapping:
      "光阑映射接近奇异，可能处于会聚点或焦散附近；请调整光阑位置或前组参数",
    folded_mapping:
      "检测到相对主光线分支翻转，未采用这条多解路径；请检查光阑附近的会聚与焦散",
    trial_trace_failed:
      "瞄准试算未能穿过前组；没有绘制试算路径，请检查前组、视场和光阑位置",
    target_unresolved:
      "该光阑坐标未找到稳定解，可能不可达或接近映射折叠；不等同于已确认的物理遮挡",
  })[reason ?? ""] ?? "光阑瞄准未找到稳定解；请检查前组、光阑位置和视场";
export function rayFailureText(status: string, reason?: string | null) {
  if (status === "aiming_failed" || status === "AimingFailed")
    return aimingReason(reason);
  const key =
    (
      {
        blocked: "Blocked",
        missed: "Missed",
        non_convergent: "NonConvergent",
        total_internal_reflection: "TotalInternalReflection",
        invalid_material: "InvalidMaterial",
      } as Record<string, string>
    )[status] ?? status;
  return translations[key] ?? key;
}
export const diagnostic = (message: string) => {
  if (message.startsWith("VirtualImage|"))
    return `无限远近轴后焦距为 ${Number(message.split("|")[1]).toFixed(4)} mm，出射光束的近轴焦点在最后一面前方。请调整镜组光焦度与间隔，再进行后方实像对焦。`;
  if (message.startsWith("AimingFailed|"))
    return aimingReason(message.split("|")[1]);
  return (
    translations[message] ??
    message
      .replace(
        /Geometry intersection with surface (\d+) \(optical or mechanical profile\)/,
        "与第 $1 面相交（含光学曲面或机械边缘），请增加厚度/间隔或调整外径",
      )
      .replace(
        /Geometry could not certify separation from surface (\d+)/,
        "无法确认与第 $1 面分离，请检查曲面定义和边缘尺寸",
      )
  );
};
export function explainError(error: unknown): string {
  const text = String(error).replace(/^Error: /, "");
  if (text.startsWith("Wave did not converge"))
    return (
      "衍射结果未通过收敛检查，未展示可能混叠的图像。请先自动对焦并采纳、缩小光阑或降低视场；采样上限为 128 时可改为 256。\n" +
      text
    );
  if (text.startsWith("Wave applicability"))
    return (
      "超出所选衍射模型的适用范围。快速模型限 ±8.59° / 方向正弦 0.25；离轴模型限 ±40.1° / 方向正弦 0.85。两者还需空气像方、稳定瞳映射及独立收敛检查。可选择离轴模型或调整设计。\n" +
      text
    );
  if (text.startsWith("Wave "))
    return "衍射计算停止，请检查通光、像面和材料设置。\n" + text;
  try {
    const ds = JSON.parse(text);
    if (ds?.code === "ray_failure")
      return `计算停止：${ds.surface === null ? "像方" : `S${ds.surface + 1}`} ${ds.stage === "aiming" ? "光阑瞄准" : "物理追迹"}，${Number(ds.wavelength_nm).toFixed(1)} nm。${rayFailureText(ds.status, ds.reason)}`;
    if (ds?.code === "virtual_image")
      return `当前无限远近轴后焦距为 ${Number(ds.bfl_mm).toFixed(4)} mm，焦点位于最后一面前方。自动对焦只能移动后方像面；请先调整曲率或镜组间隔，使后焦距为正。`;
    if (ds?.code === "ray_failures" && Array.isArray(ds.failures)) {
      const lines = ds.failures.flatMap(
        (f: {
          field_rad: number;
          wavelength_nm: number;
          failed: number;
          sampled: number;
          causes: {
            stage: string;
            status: string;
            surface: number | null;
            reason?: string | null;
            count: number;
          }[];
        }) =>
          f.causes.map(
            (c) =>
              `${((f.field_rad * 180) / Math.PI).toFixed(2)}° / ${f.wavelength_nm.toFixed(1)} nm：${c.surface === null ? "像方" : `S${c.surface + 1}`} ${c.stage === "aiming" ? "瞄准阶段" : "物理追迹"}，${c.count} 条；${rayFailureText(c.status, c.reason)}`,
          ),
      );
      return (
        "计算停止：当前采样包含未解决的瞄准或物理追迹失败，不能把失效光线当作零误差。\n" +
        lines.slice(0, 6).join("\n") +
        (lines.length > 6
          ? `\n另有 ${lines.length - 6} 项，请在“像差与通光 → 追迹失败明细”查看。`
          : "")
      );
    }
    if (Array.isArray(ds))
      return ds
        .map(
          (d) =>
            `${d.surface === null ? "系统" : `第 ${d.surface + 1} 面`}：${diagnostic(d.message)}`,
        )
        .join("；");
  } catch {}
  return diagnostic(text);
}
