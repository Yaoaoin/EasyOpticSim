"""Reproduce the actual 0.8 UI-saved scan and prove optical metadata invariance."""
import json
import hashlib
from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8-sig'))
def invoke(operation,project,**extra):
    r=subprocess.run([str(ROOT/'target/release/easyopticsim-cli.exe'),'--request'],input=json.dumps(dict(operation=operation,project=project,**extra)),text=True,encoding='utf-8',capture_output=True,check=True)
    return json.loads(r.stdout)
file='docs/fixtures/design-ui-saved-0.8.oos.json'
p=read(file);baseline=read('examples/400mm-repaired.oos.json')
keys=['schema_version','materials','surfaces','stop','object_distance','sensor','fields','wavelengths']
assert all(p[k]==baseline[k] for k in keys)
w=p['workspace'];assert len(w['groups'])==2 and len(w['versions'])==3
assert w['constraints']['design']['f_number']==16
assert any(v['variable']['kind']=='aperture' for v in w['optimization']['variables'])
assert w['versions'][-1]['groups']==w['groups']
def legacy_projection(new,old):
    if isinstance(old,dict):return {k:legacy_projection(new[k],v) for k,v in old.items()}
    if isinstance(old,list):
        assert len(new)==len(old)
        return [legacy_projection(a,b) for a,b in zip(new,old)]
    return new
record=w['aperture_scan'];assert legacy_projection(invoke('aperture_scan',record['source'],aperture_options=record['options']),record)==record
invariance={}
for op,extra in [('analyze',dict(sampling=65)),('wave',dict(wave_options=dict(field_index=2,wavelength_nm=None,max_pupil_samples=256))),('preview',dict(pattern='resolution'))]:
    assert invoke(op,p,**extra)==invoke(op,baseline,**extra)
    invariance[op]=True
coverage=read('docs/validation-400mm-coverage-0.9.json')
updated=invoke('analyze',read('examples/400mm-coverage-0.9.oos.json'),sampling=65)
assert updated['fields']==coverage['fields'] and updated['coverage']==coverage['coverage']
assert sum(s['failed'] for s in updated['spots'])==0
assert sum(s['sampled'] for s in updated['spots'])==coverage['sampled']
report=dict(version='1.0.0',fixture=file,sha256=hashlib.sha256((ROOT/file).read_bytes()).hexdigest(),surfaces=len(p['surfaces']),groups=len(w['groups']),versions=len(w['versions']),optimization_variables=len(w['optimization']['variables']),saved_scan_all_legacy_fields_reproduced_exactly=True,new_coverage_metadata_excluded_from_legacy_shape_comparison=True,optical_metadata_invariance=invariance,coverage_400mm_exactly_matches_0_9=True,coverage_sampled=coverage['sampled'])
(ROOT/'docs/validation-design-saved-1.0.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))
