// Exercise the same PDF module used by the desktop worker, against real engine results.
import { createRequire } from "node:module";
import { readFileSync, mkdirSync, writeFileSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
const req = createRequire(
    realpathSync(resolve("node_modules/vite/package.json")),
  ),
  esbuild = req("esbuild");
mkdirSync("tmp/pdfs", { recursive: true });
mkdirSync("output/pdf", { recursive: true });
await esbuild.build({
  entryPoints: ["src/drawingPdf.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "tmp/pdfs/drawing.cjs",
  logLevel: "warning",
});
const { createDrawingPdf } = createRequire(import.meta.url)(
  resolve("tmp/pdfs/drawing.cjs"),
);
const font = readFileSync("src/assets/fonts/NotoSansSC.ttf");
function invoke(operation, project, extra = {}) {
  return JSON.parse(
    execFileSync(resolve("target/release/oos-cli.exe"), ["--request"], {
      input: JSON.stringify({ operation, project, ...extra }),
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }),
  );
}
const files = [
  "examples/400mm-coverage-0.9.oos.json",
  "examples/35mm-coverage.oos.json",
];
const report = [];
for (let i = 0; i < files.length; i++) {
  const p = JSON.parse(readFileSync(files[i], "utf8")),
    source = JSON.stringify(p, null, 2),
    errors = [];
  const get = (op) => {
    try {
      return invoke(op, p, { sampling: 33 });
    } catch (e) {
      errors.push(`${op}: ${e.message}`);
      return null;
    }
  };
  const snapshot = {
    project: p,
    createdAt: new Date().toISOString(),
    analysis: get("analyze"),
    geometry: get("geometry"),
    fields: get("field_plan"),
    waves: [],
    errors,
    sampling: 33,
    waveMethod: i ? "sphere_kirchhoff" : "fast",
    sourceHash: createHash("sha256").update(source).digest("hex"),
  };
  // The narrow 400 mm system exercises multi-band PSF/MTF. Its physics was validated in 0.9.
  for (const field of i
    ? [p.fields.length - 1]
    : p.fields.map((_, index) => index)) {
    try {
      snapshot.waves.push({
        index: field,
        result: invoke("wave", p, {
          wave_options: {
            method: i ? "sphere_kirchhoff" : "fast",
            field_index: field,
            wavelength_nm: null,
            max_pupil_samples: 256,
          },
        }),
        error: null,
      });
    } catch (e) {
      snapshot.waves.push({ index: field, result: null, error: e.message });
    }
  }
  const file = `output/pdf/${i ? "35mm" : "400mm"}-OOS-1.0-technical.pdf`;
  const bytes = await createDrawingPdf(snapshot, font);
  writeFileSync(file, bytes);
  writeFileSync(
    `tmp/pdfs/${i ? "35mm" : "400mm"}-snapshot.json`,
    JSON.stringify(snapshot, null, 2),
  );
  report.push({
    source: files[i],
    pdf: file,
    bytes: bytes.length,
    sourceHash: snapshot.sourceHash,
    analysisFailed: snapshot.analysis?.spots.reduce((a, b) => a + b.failed, 0),
    waveSuccess: snapshot.waves.filter((a) => a.result).length,
    waveFailures: snapshot.waves.filter((a) => a.error).length,
  });
  console.log(JSON.stringify(report.at(-1)));
}
// An invalid draft must still export without fabricated curves or old analysis.
const p = JSON.parse(readFileSync(files[0], "utf8"));
p.name = "边界测试：无效曲面与长备注";
p.surfaces[0].curvature = 10;
p.surfaces[0].mechanical = { semi_diameter: 50, shape: "curved" };
p.description = "图纸草稿导出与分页验证";
const snapshot = {
  project: p,
  createdAt: new Date().toISOString(),
  analysis: null,
  geometry: null,
  fields: null,
  waves: [{ index: 0, result: null, error: "测试：该视场无法完成衍射分析" }],
  errors: ["测试：S1 曲面超出定义域"],
  sampling: 33,
  waveMethod: "fast",
  sourceHash: createHash("sha256")
    .update(JSON.stringify(p, null, 2))
    .digest("hex"),
};
const bytes = await createDrawingPdf(snapshot, font);
writeFileSync("output/pdf/draft-OOS-1.0-technical.pdf", bytes);
report.push({
  pdf: "output/pdf/draft-OOS-1.0-technical.pdf",
  bytes: bytes.length,
  draft: true,
});
writeFileSync("tmp/pdfs/generation.json", JSON.stringify(report, null, 2));
