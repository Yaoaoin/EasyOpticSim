"""Independent paraxial / RayOptics checks, zoom intermediates and 400 mm focus.
Uses the debug CLI so CI does not accidentally validate a stale release binary.
"""
import copy
import json
from pathlib import Path
import numpy as np
from validate_rayoptics import invoke, index, validate

ROOT = Path(__file__).resolve().parents[1]

def options(m, c, sampling=17, solve=None):
    return dict(groups=m['groups'], positions_mm=c['positions_mm'], object_distance=c['object_distance'],
                min_air_mm=m['min_air_mm'], target_f_number=c['target_f_number'], solve_group=solve,
                sampling=sampling, criterion=m['criterion'], max_rms_um=m['max_rms_um'])

def independent_efl(p):
    mat = np.eye(2); n = 1.
    for i, s in enumerate(p['surfaces']):
        n2 = index(p['materials'][s['material']], 587.5618)
        mat = np.array([[1.,0.],[-(n2-n)*s['curvature'],1.]]) @ mat
        n = n2
        if i+1 < len(p['surfaces']):
            mat = np.array([[1.,s['thickness']/n],[0.,1.]]) @ mat
    return -n/mat[1,0]

def main():
    zoom = json.loads((ROOT/'examples/24-70mm-zoom.oos.json').read_text(encoding='utf-8'))
    m = zoom['workspace']['motion']; records=[]; intermediate=[]
    for c in m['configurations']:
        r = invoke(dict(operation='motion',project=m['reference'],motion_options=options(m,c)))
        assert r['accepted'] and all(s['failed']==0 for s in r['analysis']['spots'])
        assert abs(r['analysis']['paraxial']['efl'] - c['target_efl_mm']) < 1e-6
        assert abs(independent_efl(r['project']) - r['analysis']['paraxial']['efl']) < 1e-8
        q = copy.deepcopy(r['project']); q['fields']=[f['field'] for f in r['analysis']['fields']];q.pop('field_spec',None)
        reference = validate(q)
        hi = invoke(dict(operation='motion', project=m['reference'], motion_options=options(m,c,33)))
        change = abs(hi['score_um']-r['score_um'])
        assert change < 0.5, change
        records.append(dict(configuration=c['name'],efl_mm=r['analysis']['paraxial']['efl'],f_number=r['analysis']['paraxial']['f_number'],rms_um=r['score_um'],rms_33_um=hi['score_um'],sampling_change_um=change,rayoptics=reference))
    for a,b in zip(m['configurations'],m['configurations'][1:]):
        for i in range(11):
            c=copy.deepcopy(a);t=i/10;c['positions_mm']=[x+(y-x)*t for x,y in zip(a['positions_mm'],b['positions_mm'])]
            r=invoke(dict(operation='motion',project=m['reference'],motion_options=options(m,c,7)))
            assert all(s['failed']==0 for s in r['analysis']['spots'])
            intermediate.append(dict(segment=[a['name'],b['name']],fraction=t,efl_mm=r['analysis']['paraxial']['efl'],rms_um=r['score_um'],accepted=r['accepted']))
    # Deliberately displace the compensator, then solve inside its declared range.
    c=copy.deepcopy(m['configurations'][1]);c['positions_mm'][1]+=1
    before=invoke(dict(operation='motion',project=m['reference'],motion_options=options(m,c,7)))
    focused=invoke(dict(operation='motion',project=m['reference'],motion_options=options(m,c,7,1)))
    assert focused['accepted'] and focused['score_um'] < before['score_um']
    p=json.loads((ROOT/'examples/400mm-repaired.oos.json').read_text(encoding='utf-8'))
    groups=[dict(start=0,end=len(p['surfaces'])-1,min_mm=-25.,max_mm=5.,locked=False)]
    o=dict(groups=groups,positions_mm=[0.],object_distance=10000.,min_air_mm=0.,target_f_number=None,solve_group=0,sampling=7,criterion='balanced',max_rms_um=50.)
    long=invoke(dict(operation='motion',project=p,motion_options=o))
    assert long['accepted'],long['diagnostic']
    assert abs(sum(s['thickness'] for s in long['project']['surfaces'])+long['origin_shift_mm']-sum(s['thickness'] for s in p['surfaces'])) < 1e-8
    long_reference=validate(long['project'])
    report=dict(version='1.1.0',scope='Geometric motion, fixed sensor, finite-object coordinates, paraxial EFL and independent RayOptics intersections; does not certify zoom PSF/MTF or full-frame coverage',zoom=records,intermediates=intermediate,compensation=dict(before_rms_um=before['score_um'],after_rms_um=focused['score_um'],actual_efl_mm=focused['analysis']['paraxial']['efl'],positions_mm=focused['positions_mm']),focus400=dict(object_distance_reference_mm=10000.,positions_mm=long['positions_mm'],rms_um=long['score_um'],rayoptics=long_reference))
    (ROOT/'docs/validation-motion-1.1.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))

if __name__ == '__main__':
    main()
