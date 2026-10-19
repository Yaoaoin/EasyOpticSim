"""0.7 integration regression: failure phases, repaired lens and save metadata.

RayOptics/NumPy independent optical comparison is validate_diffraction.py
--extra-project examples/400mm-repaired.oos.json. This script checks product contracts.
"""
import copy
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / "target/release/oos-cli.exe"


def invoke(operation, project, **extra):
    result = subprocess.run([str(CLI), "--request"],
                            input=json.dumps(dict(operation=operation, project=project, **extra)),
                            text=True, encoding="utf-8", capture_output=True, check=True)
    return json.loads(result.stdout)


original = json.loads((ROOT / "crates/optics/tests/fixtures/telephoto-original.oos.json").read_text(encoding="utf-8"))
repaired = json.loads((ROOT / "examples/400mm-repaired.oos.json").read_text(encoding="utf-8"))
old = invoke("analyze", original, sampling=25)
phases = {}
for spot in old["spots"]:
    assert sum(f["count"] for f in spot["failures"]) == spot["failed"]
    for failure in spot["failures"]:
        key = failure["stage"] + ":" + failure["status"]
        phases[key] = phases.get(key, 0) + failure["count"]
assert phases["aiming:aiming_failed"] > 0
for ray in old["rays"]:
    if ray["stage"] == "aiming":
        assert ray["status"] == "aiming_failed" and not ray["points"]
    elif len(ray["points"]) > 1 and sum(v*v for v in ray["points"][1][:2]) > 35.**2 + 1e-6:
        assert ray["surface"] == 0 and ray["status"] == "blocked" and len(ray["points"]) == 2
current = invoke("analyze", repaired, sampling=65)
assert abs(current["paraxial"]["efl"] - 400) < .01
assert current["paraxial"]["bfl"] > 380
assert abs(current["paraxial"]["f_number"] - 16) < .001
assert all(s["failed"] == 0 for s in current["spots"])
assert all(f["polychromatic_rms_um"] < 16 for f in current["fields"])
assert repaired["materials"] == original["materials"]
assert [s["thickness"] for s in original["surfaces"][:-1]] == [s["thickness"] for s in repaired["surfaces"][:-1]]
# Actual serialized disk round trip, then strip UI metadata; all optical outputs identical.
saved = ROOT / "artifacts/validation-0.7/repaired-cli-saved.oos.json"
saved.parent.mkdir(parents=True, exist_ok=True)
saved.write_text(json.dumps(repaired, ensure_ascii=False, indent=2), encoding="utf-8")
reopened = json.loads(saved.read_text(encoding="utf-8"))
assert reopened == repaired
plain = copy.deepcopy(reopened)
plain.pop("workspace")
wave_options = dict(field_index=2, wavelength_nm=None, max_pupil_samples=256)
invariance = {}
for operation, extra in [("analyze", dict(sampling=33)),
                         ("wave", dict(wave_options=wave_options)),
                         ("preview", dict(wave_options=wave_options, pattern="resolution"))]:
    assert invoke(operation, reopened, **extra) == invoke(operation, plain, **extra)
    invariance[operation] = True
candidate = invoke("optimize", reopened, optimization=reopened["workspace"]["optimization"],
                   constraints=reopened["workspace"]["constraints"])
assert candidate["accepted"] and all(c["passed"] for c in candidate["checks"])
assert all(s["failed"] == 0 for s in invoke("analyze", candidate["project"], sampling=65)["spots"])
report = dict(version="0.7.0", scope="CLI integration regression, not independent optical reference",
              original_failure_phases=phases,
              suppressed_display_aiming_paths=sum(r["stage"] == "aiming" for r in old["rays"]),
              repaired_paraxial=current["paraxial"],
              repaired_sampled=sum(s["sampled"] for s in current["spots"]), repaired_failed=0,
              json_disk_roundtrip=True, metadata_invariance=invariance,
              constraint_checks=len(candidate["checks"]), candidate_adoptable=candidate["accepted"],
              optimized_image_distance_mm=candidate["project"]["surfaces"][-1]["thickness"],
              optimized_dense_failed=0)
(ROOT / "docs/validation-aiming.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(report, ensure_ascii=True, indent=2))
