"""0.3 end-to-end file/engine regression; invariance test, not an independent optical solver."""
from pathlib import Path
import copy
import json
import subprocess
import tempfile
import tomllib

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "target/release/oos-cli.exe"
def invoke(operation, p, **extra):
    result = subprocess.run([str(CLI), "--request"], input=json.dumps(dict(operation=operation,project=p,**extra)), text=True,encoding="utf-8",capture_output=True,check=True)
    return json.loads(result.stdout)

projects=json.loads(subprocess.check_output([str(CLI),"examples"],encoding="utf-8"))
records=[]
for p in projects:
    original=invoke("analyze",p,sampling=25)
    q=copy.deepcopy(p);q["schema_version"]=2
    for i,s in enumerate(q["surfaces"]):
        if s["material"] != 0 or (i and q["surfaces"][i-1]["material"] != 0):
            s["mechanical"]=dict(semi_diameter=16.,shape="flat")
    assert invoke("validate",q)==[]
    assert invoke("analyze",q,sampling=25)==original
    with tempfile.TemporaryDirectory() as folder:
        path=Path(folder)/"保存重开.oos.json"
        path.write_text(json.dumps(q,ensure_ascii=False,indent=2),encoding="utf-8")
        restored=json.loads(path.read_text(encoding="utf-8"))
        assert restored==q
        assert invoke("analyze",restored,sampling=25)==original
    records.append(dict(name=p["name"],geometry_equal=True,json_roundtrip_equal=True,ray_paths_equal=True))

p=copy.deepcopy(projects[1]);p["fields"]=[0.,.05]
p=invoke("autofocus",p)["project"]
before=invoke("wave",p,wave_options=dict(field_index=1,wavelength_nm=None,max_pupil_samples=256))
image_before=invoke("preview",p,pattern="resolution")
q=copy.deepcopy(p);q["schema_version"]=2
for s in q["surfaces"][1:]: s["mechanical"]=dict(semi_diameter=15.,shape="flat")
after=invoke("wave",q,wave_options=dict(field_index=1,wavelength_nm=None,max_pupil_samples=256))
image_after=invoke("preview",q,pattern="resolution")
assert after==before and image_after==image_before
blank=copy.deepcopy(q);blank["surfaces"]=[];blank["stop"]=0
assert invoke("validate",blank)==[]
report=dict(version=tomllib.loads((ROOT/"Cargo.toml").read_text(encoding="utf-8"))["workspace"]["package"]["version"],scope="Mechanical-only edit invariance and serialization, same optical engine before/after",projects=records,
            wave=dict(field_rad=.05,bands=len(before["bands"]),psf_pixels=len(before["psf"]),exact_json_equality=True),
            imaging=dict(fields=len(image_before["frames"]),exact_json_equality=True),empty_project_valid=True)
(ROOT/"docs/validation-mechanics.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
(ROOT/"examples/mechanical-annulus.oos.json").write_text(json.dumps(projects[-1],ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps(report,ensure_ascii=True,indent=2))
