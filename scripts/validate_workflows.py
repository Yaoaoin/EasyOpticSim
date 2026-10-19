"""0.4 workflow invariants and quadratic image-distance reference (not a second ray tracer)."""
import copy
import json
import math
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "target/release/oos-cli.exe"

def invoke(operation, project, **extras):
    result = subprocess.run([str(CLI), "--request"], input=json.dumps(dict(operation=operation, project=project, **extras)),
                            text=True, encoding="utf-8", capture_output=True, check=True)
    return json.loads(result.stdout)

projects = json.loads(subprocess.check_output([str(CLI), "examples"], encoding="utf-8"))
p = projects[0]
options = dict(min_mm=40., max_mm=60., steps=41, sampling=17, criterion="balanced")
scan = invoke("focus_scan", p, focus_options=options)
points = scan["points"]
a, b, c = [points[i]["score_um"]**2 for i in (0, 20, 40)]
reference = 50 + 5*(a-c)/(a-2*b+c)
best = points[scan["best_index"]]["image_distance_mm"]
assert abs(reference-best) <= .250001
limits = dict(target_efl_mm=invoke("analyze", p)["paraxial"]["efl"], efl_tolerance_mm=.1,
              max_length_mm=80., min_center_mm=1., min_edge_mm=.2, min_air_mm=0.)
candidate = invoke("optimize", p, variables=[dict(kind="thickness",surface=len(p["surfaces"])-1)], constraints=limits)
assert candidate["accepted"] and all(c["passed"] for c in candidate["checks"])
impossible = dict(limits, target_efl_mm=200., min_center_mm=20.)
rejected = invoke("optimize", p, variables=[dict(kind="thickness",surface=len(p["surfaces"])-1)], constraints=impossible)
assert not rejected["accepted"]

baseline = copy.deepcopy(projects[1])
baseline["fields"] = [0., .035, .05]
baseline["surfaces"][baseline["stop"]]["semi_aperture"] = 2.
baseline = invoke("autofocus", baseline)["project"]
variant = copy.deepcopy(baseline)
variant["surfaces"][-1]["thickness"] += .05
doc = copy.deepcopy(variant)
doc["name"] = "0.4 版本与衍射对比示例"
doc["workspace"] = dict(schema_version=1, focus=dict(options, min_mm=baseline["surfaces"][-1]["thickness"]-.5, max_mm=baseline["surfaces"][-1]["thickness"]+.5),
                        constraints=dict(limits,target_efl_mm=invoke("analyze",baseline)["paraxial"]["efl"]), versions=[
    dict(id="baseline",name="多色对焦基准",created_at="2026-10-18T00:00:00Z",note="原创双胶合教学处方，光阑半径 2 mm。",prescription=baseline),
    dict(id="defocus",name="像面后移 0.05 mm",created_at="2026-10-18T00:00:01Z",note="仅改变像距，比较离焦对画质的影响。",prescription=variant)])
path = ROOT / "examples/version-workflow.oos.json"
path.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
reopened = json.loads(path.read_text(encoding="utf-8"))
assert reopened == doc
plain = copy.deepcopy(doc);plain.pop("workspace")
geometry = invoke("analyze",plain,sampling=33)
assert invoke("analyze",reopened,sampling=33)==geometry
wave_options = dict(field_index=0,wavelength_nm=None,max_pupil_samples=256)
wave = invoke("wave",plain,wave_options=wave_options)
assert invoke("wave",reopened,wave_options=wave_options)==wave
image = invoke("preview",plain,pattern="resolution",wave_options=wave_options)
assert invoke("preview",reopened,pattern="resolution",wave_options=wave_options)==image
base_wave = invoke("wave",baseline,wave_options=wave_options)
assert base_wave != wave
report = dict(version="0.4.0",scope="Workflow regression, metadata invariance and independent quadratic minimum fit; same underlying optical engine",
              focus=dict(sampling=17,points=41,quadratic_reference_mm=reference,scan_best_mm=best,error_mm=abs(reference-best)),
              optimization=dict(before_rms_um=candidate["before_rms_um"],after_rms_um=candidate["after_rms_um"],sampling=candidate["sampling"],checks=candidate["checks"],impossible_candidate_adoptable=rejected["accepted"]),
              persistence=dict(version_count=2,full_document_equal=True,geometry_exact_json_equal=True,psf_mtf_exact_json_equal=True,imaging_exact_json_equal=True),
              comparison=dict(common_fields=plain["fields"],common_wavelengths=plain["wavelengths"],common_geometric_sampling=33,
                              psf_pixel_um=[base_wave["pixel_um"],wave["pixel_um"]],mtf_frequency_step_lp_mm=[base_wave["frequency_step_lp_mm"],wave["frequency_step_lp_mm"]],
                              quality=[base_wave["quality"],wave["quality"]]))
(ROOT/"docs/validation-workflows.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=True,indent=2))
