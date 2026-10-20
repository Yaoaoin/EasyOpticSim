"""Independent RayOptics profile intersection/refraction cross-check.

Reuses OSS input origins, independently derives incident directions from the
project object definition, then compares every intersection and optical path.
This does NOT certify OSS pupil aiming or diffraction.
"""
import json
import math
from pathlib import Path
import subprocess
import numpy as np
from rayoptics.elem.profiles import Spherical, EvenPolynomial
from rayoptics.raytr.raytrace import bend
from importlib.metadata import version

ROOT = Path(__file__).resolve().parents[1]
CLI = ROOT / 'target' / 'debug' / 'easyopticsim-cli.exe'

def invoke(request):
    result = subprocess.run([str(CLI), '--request'], input=json.dumps(request), text=True, encoding='utf-8', capture_output=True, check=True)
    return json.loads(result.stdout)

def index(m, nm):
    if m['sellmeier'] is None:
        return m['n']
    b,c = m['sellmeier']; l2 = (nm/1000)**2
    return math.sqrt(1+sum(bi*l2/(l2-ci) for bi,ci in zip(b,c)))

def validate(project):
    result = invoke(dict(operation='analyze', project=project, sampling=7))
    worst_point = worst_opl = worst_direction = 0.
    count = 0
    for i, ray in enumerate(result['rays']):
        if ray['status'] != 'complete':
            continue
        nm = ray['wavelength_nm']
        field = project['fields'][i//(7*len(project['wavelengths']))]
        origin = np.array(ray['points'][0]); q=origin.copy()
        if project['object_distance'] is None:
            direction = np.array([0., math.sin(field), math.cos(field)])
        else:
            dist=project['object_distance']
            direction=q-np.array([0.,-dist*math.tan(field),-dist])
            direction/=np.linalg.norm(direction)
        z=0.; n=1.; opl=0.
        for j,s in enumerate(project['surfaces']):
            profile = EvenPolynomial(c=s['curvature'], cc=s['conic'], coefs=[0.,*s['asphere']]) if s['conic'] or any(s['asphere']) else Spherical(c=s['curvature'])
            local=q-np.array([0.,0.,z])
            # RayOptics spherical intersection expects a point near the
            # perpendicular plane through the surface vertex.
            shift=-np.dot(local,direction)
            dt,hit=profile.intersect(local+shift*direction,direction,eps=1e-12,z_dir=1)
            t=shift+dt
            opl+=n*t
            q=hit+np.array([0.,0.,z])
            worst_point=max(worst_point,float(np.max(np.abs(q-np.array(ray['points'][j+1])))))
            n2=index(project['materials'][s['material']],nm)
            direction=bend(direction,profile.normal(hit),n,n2)
            n=n2;z+=s['thickness']
        t=(z-q[2])/direction[2];q+=t*direction;opl+=n*t
        worst_point=max(worst_point,float(np.max(np.abs(q-np.array(ray['points'][-1])))))
        worst_opl=max(worst_opl,abs(opl-ray['optical_path']))
        worst_direction=max(worst_direction,float(np.max(np.abs(direction-ray['direction']))))
        count+=1
    assert count>0
    assert worst_point < 1e-6, worst_point
    assert worst_opl < 1e-6, worst_opl
    assert worst_direction < 1e-9, worst_direction
    return dict(name=project['name'],rays=count,max_intersection_error_mm=worst_point,max_optical_path_error_mm=worst_opl,max_direction_error=worst_direction)

if __name__ == "__main__":
    projects=json.loads(subprocess.check_output([str(CLI),'examples'],encoding='utf-8'))
    extra=json.loads(json.dumps(projects[0]));extra['name']='Aspheric + finite object';extra['object_distance']=1000.;extra['surfaces'][1]['conic']=-0.5;extra['surfaces'][1]['asphere'][0]=1e-6
    projects.append(extra)
    report=dict(reference='RayOptics '+version('rayoptics'),scope='Sequential geometric intersections, directions and optical path; not diffraction or pupil aiming',results=[validate(p) for p in projects])
    output=ROOT/'docs'/'validation-rayoptics.json';output.parent.mkdir(exist_ok=True);output.write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=True,indent=2))
