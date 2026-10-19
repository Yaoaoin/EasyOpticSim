import { useEffect, useState } from "react";
import type { Material } from "./types";
export default function MaterialEditor({
  material,
  onApply,
}: {
  material: Material;
  onApply: (m: Material) => void;
}) {
  const [text, setText] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    setText(JSON.stringify(material, null, 2));
    setError("");
  }, [material]);
  return (
    <details>
      <summary>材料系数与来源</summary>
      <textarea
        aria-label="材料 JSON"
        className="material-json"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        onClick={() => {
          try {
            const m = JSON.parse(text);
            if (
              typeof m.name !== "string" ||
              typeof m.source !== "string" ||
              !Number.isFinite(m.n) ||
              !Array.isArray(m.range_nm) ||
              m.range_nm.length !== 2 ||
              m.range_nm.some(
                (x: unknown) => typeof x !== "number" || !Number.isFinite(x),
              ) ||
              m.range_nm[0] >= m.range_nm[1]
            )
              throw Error("需要名称、折射率、有效波段和来源");
            if (
              m.sellmeier !== null &&
              (!Array.isArray(m.sellmeier) ||
                m.sellmeier.length !== 2 ||
                m.sellmeier.some(
                  (r: unknown) =>
                    !Array.isArray(r) ||
                    r.length !== 3 ||
                    r.some((x) => typeof x !== "number" || !Number.isFinite(x)),
                ))
            )
              throw Error("Sellmeier 格式为 [[B1,B2,B3],[C1,C2,C3]]，或 null");
            onApply(m);
            setError("");
          } catch (e) {
            setError(String(e));
          }
        }}
      >
        应用材料快照
      </button>
      {error && <p className="error">{error}</p>}
      <p className="hint">
        Sellmeier 波长使用 µm，C 系数为
        µm²。修改会影响所有引用该材料的表面。请保留数据来源。
      </p>
    </details>
  );
}
