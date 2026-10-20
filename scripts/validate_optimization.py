"""0.6 CLI integration: bounded search, reported weights, material snapshots and metadata invariance."""
import copy
import json
import math
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/"target/release/easyopticsim-cli.exe"
def invoke(operation,project,**extra):
    r=subprocess.run([str(CLI),"--request"],input=json.dumps(dict(operation=operation,project=project,**extra)),text=True,encoding="utf-8",capture_output=True)
    if r.returncode: raise RuntimeError(r.stderr)
    return json.loads(r.stdout)
p=json.loads(subprocess.check_output([str(CLI),"examples"],encoding="utf-8"))[0]
limits=dict(target_efl_mm=invoke("analyze",p)["paraxial"]["efl"],efl_tolerance_mm=.5,max_length_mm=100.,min_center_mm=1.,min_edge_mm=.2,min_air_mm=0.)
variables=[dict(variable=dict(kind="curvature",surface=1),min=p["surfaces"][1]["curvature"]-.002,max=p["surfaces"][1]["curvature"]+.002,locked=True),
           dict(variable=dict(kind="thickness",surface=2),min=46.,max=47.,locked=False)]
results=[]
for preset in ["center","balanced","edge"]:
    options=dict(variables=variables,preset=preset,max_iterations=30)
    candidate=invoke("optimize",p,optimization=options,constraints=limits)
    assert candidate["accepted"]==all(c["passed"] for c in candidate["checks"])
    assert 46.<=candidate["project"]["surfaces"][2]["thickness"]<=47.
    assert candidate["project"]["surfaces"][1]["curvature"]==p["surfaces"][1]["curvature"]
    a=invoke("analyze",candidate["project"],sampling=33)
    weights=[1.+3*(1-abs(f)/.1)**2 if preset=="center" else 1.+3*(f/.1)**2 if preset=="edge" else 1. for f in p["fields"]]
    weights=[w/sum(weights) for w in weights]
    expected=math.sqrt(sum(w*f["polychromatic_rms_um"]**2 for w,f in zip(weights,a["fields"])))
    assert abs(expected-candidate["report"]["after_weighted_rms_um"])<1e-10
    results.append(dict(preset=preset,adoptable=candidate["accepted"],weighted_rms_um=expected,image_distance_mm=candidate["project"]["surfaces"][2]["thickness"],iterations=candidate["iterations"],stop_reason=candidate["report"]["stop_reason"]))
options=dict(variables=variables,preset="balanced",max_iterations=25)
bad=invoke("optimize",p,optimization=options,constraints=dict(limits,target_efl_mm=500.))
assert not bad["accepted"] and any(c["name"]=="efl_error_mm" and not c["passed"] for c in bad["checks"])
stream=subprocess.run([str(CLI),"--request-progress"],input=json.dumps(dict(operation="optimize",project=p,optimization=options,constraints=limits)),text=True,encoding="utf-8",capture_output=True,check=True)
events=[json.loads(line) for line in stream.stdout.splitlines()]
assert "result" in events[-1] and all("progress" in e for e in events[:-1])
assert len(events)-1==events[-1]["result"]["iterations"]+1
catalog=json.loads((ROOT/"src/data/glass-catalog.json").read_text(encoding="utf-8"))
glass_results=[]
for entry in catalog["entries"]:
    q=copy.deepcopy(p)
    material={k:entry[k] for k in ["name","n","sellmeier","range_nm","source"]}
    q["materials"].append(material);q["surfaces"][1]["material"]=len(q["materials"])-1
    assert not invoke("validate",q)
    a=invoke("analyze",q,sampling=33)
    glass_results.append(dict(name=entry["name"],efl_mm=a["paraxial"]["efl"],failed_rays=sum(s["failed"] for s in a["spots"])))
baseline=json.loads((ROOT/"examples/version-workflow.oos.json").read_text(encoding="utf-8"))
doc=copy.deepcopy(baseline);doc["name"]="0.6 优化与材料工作流";doc["workspace"]["optimization"]=options
# Use valid bounds for this different lens; metadata must have no influence on engine outputs.
doc["workspace"]["optimization"]["variables"]=[dict(variable=dict(kind="thickness",surface=len(doc["surfaces"])-1),min=1.,max=100.,locked=False)]
plain=copy.deepcopy(doc);plain.pop("workspace")
wave_options=dict(field_index=0,wavelength_nm=None,max_pupil_samples=256)
for op,extra in [("analyze",dict(sampling=33)),("wave",dict(wave_options=wave_options)),("preview",dict(wave_options=wave_options,pattern="resolution"))]:
    assert invoke(op,doc,**extra)==invoke(op,plain,**extra)
report=dict(version="0.6.0",scope="CLI integration and independently recomputed merit/weights; optical ray tracing is the same engine",presets=results,
            blockers=[c for c in bad["checks"] if not c["passed"]],progress_events=len(events)-1,glass_models=glass_results,
            metadata_invariance=dict(geometry=True,psf_mtf=True,imaging=True))
(ROOT/"docs/validation-optimization.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
(ROOT/"docs/fixtures/optimization-workflow.oos.json").write_text(json.dumps(doc,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=True,indent=2))
