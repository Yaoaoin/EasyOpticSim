"""0.8 CLI contracts and regression against the recorded 0.7 400 mm baseline."""
import copy
import json
import math
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/'target/release/easyopticsim-cli.exe'
def invoke(operation,project,**extra):
    r=subprocess.run([str(CLI),'--request'],input=json.dumps(dict(operation=operation,project=project,**extra)),text=True,encoding='utf-8',capture_output=True,check=True)
    return json.loads(r.stdout)
def load(path):return json.loads((ROOT/path).read_text(encoding='utf-8-sig'))
def write(path,data): (ROOT/path).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
def strip(p):return {k:copy.deepcopy(v) for k,v in p.items() if k!='workspace'}
def aperture(p,point):
    q=strip(p);s=q['surfaces'][q['stop']];s['semi_aperture']=point['stop_radius_mm']
    if 'mechanical' in s:s['mechanical']['semi_diameter']=max(s['mechanical']['semi_diameter'],s['semi_aperture'])
    q['surfaces'][-1]['thickness']=point['image_distance_mm']
    return q
p=load('examples/400mm-repaired.oos.json')
baseline=load('docs/validation-400mm-repair.json')
a=invoke('analyze',p,sampling=65)
assert a['paraxial']==baseline['paraxial']
assert [f['polychromatic_rms_um'] for f in a['fields']]==[f['rms_um'] for f in baseline['fields']]
assert sum(s['failed'] for s in a['spots'])==0
options=dict(f_numbers=[4.,8.,11.,16.,22.],refocus=False,sampling=17,mtf=True)
scan=invoke('aperture_scan',p,aperture_options=options)
for point in scan['points']:
    if point['sampled']:
        q=aperture(p,point);direct=invoke('analyze',q,sampling=17)
        assert point['fields_rms_um']==[f['polychromatic_rms_um'] for f in direct['fields']]
        assert point['failed']==sum(s['failed'] for s in direct['spots'])
    assert abs(point['actual_f_number']-point['requested_f_number'])<1e-10
    assert point['image_distance_mm']==p['surfaces'][-1]['thickness']
    if point['failed']:assert point['score_um'] is None
assert any(v['failed']>0 for v in scan['points']) and scan['best_index'] is not None
refocus=invoke('aperture_scan',p,aperture_options=dict(options,f_numbers=[8.,16.,22.],refocus=True,mtf=False))
for point in refocus['points']:
    if point['score_um'] is not None:
        q=aperture(p,dict(point,image_distance_mm=p['surfaces'][-1]['thickness']))
        direct=invoke('autofocus',q)['project']
        assert point['image_distance_mm']==direct['surfaces'][-1]['thickness']
        assert point['fields_rms_um']==[f['polychromatic_rms_um'] for f in invoke('analyze',direct,sampling=17)['fields']]
maps=[]
for field in range(len(p['fields'])):
    m=invoke('stop_map',p,sampling=17,wave_options=dict(field_index=field,wavelength_nm=587.5618,max_pupil_samples=128))
    status={}
    for sample in m['samples']:
        ray=sample['ray'];status[ray['stage']+':'+ray['status']]=status.get(ray['stage']+':'+ray['status'],0)+1
        if ray['stage']=='aiming':assert ray['points']==[]
        else:assert ray['aiming']['target_mm']==sample['target_mm']
    assert status=={'trace:complete':len(m['samples'])}
    maps.append(dict(field=field,status=status))
q=invoke('move_group',p,group_move=dict(start=2,end=5,delta_mm=.01))
assert abs(sum(s['thickness'] for s in p['surfaces'])-sum(s['thickness'] for s in q['surfaces']))<1e-10
for i,(s,t) in enumerate(zip(p['surfaces'],q['surfaces'])):
    for k in s:
        if k!='thickness' or i not in [1,5]:assert s[k]==t[k]
workflow=copy.deepcopy(p)
workflow['name']='400 mm 光圈与镜组工作区 · f/16'
workflow['description']='0.8 教学验证工作区：保留 0.7 修正版光学处方，附固定像面光圈扫描、设计目标和可移动中组。不是佳能 f/2.8 复刻。'
w=workflow['workspace'];w['aperture']=options;w['aperture_scan']=scan
w['groups']=[dict(id='middle-pair',name='中前组（第 2–3 枚）',start=2,end=5)]
w['constraints']['design']=dict(f_number=16.,f_tolerance=.1,min_bfl_mm=1.,max_front_diameter_mm=70.)
write('examples/400mm-workflow-0.8.oos.json',workflow)
reopened=load('examples/400mm-workflow-0.8.oos.json')
assert reopened==workflow
checks=invoke('checks',reopened,constraints=w['constraints']);assert all(c['passed'] for c in checks)
bad=copy.deepcopy(w['constraints']);bad['design']['f_number']=2.8
assert any(c['name']=='f_number_error' and not c['passed'] for c in invoke('checks',reopened,constraints=bad))
invariance={}
for op,extra in [('analyze',dict(sampling=33)),('wave',dict(wave_options=dict(field_index=2,wavelength_nm=None,max_pupil_samples=256))),('preview',dict(pattern='resolution'))]:
    assert invoke(op,reopened,**extra)==invoke(op,p,**extra)
    invariance[op]=True
report=dict(version='0.8.0',baseline_0_7_identical=True,baseline_dense_rays=sum(s['sampled'] for s in a['spots']),baseline_failed=0,
            fixed_scan=scan['points'],refocused_scan=refocus['points'],best_fixed_index=scan['best_index'],pupil_maps=maps,
            groups=dict(internal_prescription_preserved=True,sensor_fixed=True,delta_mm=.01),
            saved_project='examples/400mm-workflow-0.8.oos.json',json_roundtrip=True,metadata_invariance=invariance,
            active_constraint_checks=len(checks),all_checks_passed=True)
write('docs/validation-design-0.8.json',report)
print(json.dumps(dict(version='0.8.0',fixed=[dict(f=v['requested_f_number'],failed=v['failed'],rms=v['score_um'],mtf_passed=sum(m['quality'] is not None for m in v['mtf'])) for v in scan['points']],refocused=[dict(f=v['requested_f_number'],image_distance=v['image_distance_mm'],rms=v['score_um']) for v in refocus['points']],checks=len(checks),invariance=invariance),indent=2))
