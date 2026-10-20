"""0.9 independent wide-field geometry, height inversion and scalar propagation.

RayOptics supplies intersections/Snell; SciPy independently shoots the stop and
inverts real image height. NumPy integrates Kirchhoff on the flat sensor.
The full pupil check shares OSS sampling origins/mask; amplitude is independently
checked at stratified samples. This is not validation of all pupil topologies,
Fresnel transmission, polarization or a commercial photographic prescription.
"""
import copy
import hashlib
import json
import math
import os
import subprocess
import time
from pathlib import Path
from importlib.metadata import version
import numpy as np
from scipy.optimize import root, brentq
from rayoptics.elem.profiles import Spherical, EvenPolynomial
from rayoptics.raytr.raytrace import bend

ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/'target/release/easyopticsim-cli.exe'
def read(p): return json.loads((ROOT/p).read_text(encoding='utf-8-sig'))
def call(op,p,**kw):
    r=subprocess.run([str(CLI),'--request'],input=json.dumps(dict(operation=op,project=p,**kw)),capture_output=True,text=True,encoding='utf8')
    if r.returncode: raise RuntimeError(r.stderr)
    return json.loads(r.stdout)
def index(m,nm):
    if m['sellmeier'] is None:return m['n']
    b,c=m['sellmeier'];l2=(nm/1000)**2
    return math.sqrt(1+sum(bi*l2/(l2-ci) for bi,ci in zip(b,c)))
class Reference:
    def __init__(self,p,nm):
        self.p=p;self.nm=nm
        self.profiles=[EvenPolynomial(c=s['curvature'],cc=s['conic'],coefs=[0,*s['asphere']]) if s['conic'] or any(s['asphere']) else Spherical(c=s['curvature']) for s in p['surfaces']]
        self.z0=min(0.,*(self.profiles[0].sag(0.,p['surfaces'][0]['semi_aperture']*i/32) for i in range(33)))-.5
        self.indices=[index(p['materials'][s['material']],nm) for s in p['surfaces']]
    def trace(self,xy,field,stop=None,clip=False):
        p=self.p;q=np.array([*xy,self.z0]);points=[q.copy()]
        if p['object_distance'] is None:d=np.array([0.,math.sin(field),math.cos(field)]);opl=q[1]*math.sin(field)
        else:
            obj=np.array([0.,-p['object_distance']*math.tan(field),-p['object_distance']]);d=q-obj;distance=np.linalg.norm(d);d/=distance
            lateral=-obj[1];axial=self.z0-obj[2];ref=math.hypot(lateral,axial)
            opl=(q[0]**2+q[1]*(q[1]+2*lateral))/(distance+ref)
        z=0.;n=1.
        for i,(s,pr,n2) in enumerate(zip(p['surfaces'],self.profiles,self.indices)):
            local=q-np.array([0.,0.,z]);shift=-local@d
            dt,hit=pr.intersect(local+shift*d,d,eps=1e-12,z_dir=1)
            opl+=n*(shift+dt);q=hit+np.array([0.,0.,z]);points.append(q.copy())
            if clip:assert np.linalg.norm(hit[:2])<=s['semi_aperture']+1e-7
            if i==stop:return q,d,opl,points
            d=bend(d,pr.normal(hit),n,n2);n=n2;z+=s['thickness']
        return q,d,opl,points
    def aim(self,field,target):
        stopz=sum(s['thickness'] for s in self.p['surfaces'][:self.p['stop']])
        seed=[target[0],target[1]-(stopz-self.z0)*math.tan(field)]
        solved=root(lambda xy:self.trace(xy,field,self.p['stop'])[0][:2]-target,seed,tol=1e-10)
        assert np.linalg.norm(solved.fun)<1e-7,(solved.fun,field,target)
        return solved.x
    def image(self,xy,field):
        q,d,_,_=self.trace(xy,field)
        return q+(sum(s['thickness'] for s in self.p['surfaces'])-q[2])/d[2]*d
    def exit_pupil(self):
        m=np.eye(2);n=1.;z=0.
        for i,(s,n2) in enumerate(zip(self.p['surfaces'],self.indices)):
            if i>=self.p['stop']:
                m=np.array([[1,0],[(n-n2)*s['curvature']/n2,n/n2]])@m
                if i+1<len(self.indices):m=np.array([[1,s['thickness']],[0,1]])@m
            n=n2;last=z;z+=s['thickness']
        return last-m[0,1]/m[1,1]
def sphere(q,d,opl,image,radius):
    roots=np.roots([1.,2*np.dot(q-image,d),np.dot(q-image,q-image)-radius**2])
    assert np.all(np.isreal(roots))
    t=float(np.min(roots));return q+t*d,opl+t

def geometry(p):
    ref=Reference(p,587.5618);a=call('analyze',p,sampling=17)
    worst_point=worst_stop=worst_opl=worst_height=0.;rays=0
    per_field=len(a['rays'])//len(a['fields'])
    for i,f in enumerate(a['fields']):
        angle=f['field'];radius=p['surfaces'][p['stop']]['semi_aperture']
        for target in [[0.,0.],[radius,0.],[-radius,0.],[0.,radius],[0.,-radius]]:
            xy=ref.aim(angle,np.array(target));actual=ref.trace(xy,angle,p['stop'])[0]
            worst_stop=max(worst_stop,float(np.linalg.norm(actual[:2]-target)))
            if target==[0.,0.] and p.get('field_spec'):
                height=[0,min(p['sensor'])/2,max(p['sensor'])/2,math.hypot(*p['sensor'])/2][i]
                independent=0. if height==0 else brentq(lambda angle:ref.image(ref.aim(angle,np.zeros(2)),angle)[1]-height,0,.7,xtol=1e-13)
                worst_height=max(worst_height,abs(independent-angle))
        for ray in a['rays'][i*per_field:(i+1)*per_field]:
            if ray['status']!='complete':continue
            xy=ray['points'][0][:2];q,d,opl,points=ref.trace(xy,angle,clip=True)
            z=sum(s['thickness'] for s in p['surfaces']);t=(z-q[2])/d[2];points.append(q+t*d);opl+=t
            # Compare absolute OPL without the incident-plane phase.
            opl-=xy[1]*math.sin(angle) if p['object_distance'] is None else 0.
            worst_point=max(worst_point,float(np.max(np.abs(np.array(points)-ray['points']))))
            worst_opl=max(worst_opl,abs(opl-ray['optical_path']));rays+=1
    assert worst_point<1e-6 and worst_stop<1e-7 and worst_height<1e-8
    return dict(name=p['name'],fields_rad=[f['field'] for f in a['fields']],rays=rays,max_intersection_error_mm=worst_point,max_opl_error_mm=worst_opl,max_independent_stop_residual_mm=worst_stop,max_independent_field_angle_error_rad=worst_height,coverage=a['coverage'])

def diffraction(p,angle):
    p=copy.deepcopy(p);p.pop('field_spec',None);p['fields']=[angle]
    opts=dict(method='sphere_kirchhoff',field_index=0,wavelength_nm=587.5618,max_pupil_samples=256)
    start=time.perf_counter();w=call('wave',p,wave_options=opts)
    grid=call('pupils',p,sampling=w['quality']['pupil_sampling'],wave_options=opts)['bands'][0][1]
    ref=Reference(p,587.5618);chief=ref.aim(angle,np.zeros(2));q,d,opl,_=ref.trace(chief,angle);image=ref.image(chief,angle)
    centre=q+(ref.exit_pupil()-q[2])/d[2]*d;radius=np.linalg.norm(image-centre);chief_opl=sphere(q,d,opl,image,radius)[1]
    normals=[];phases=[];nd=[];amplitudes=[];worst_opd=worst_map=worst_amplitude=0.
    selected=[i for i,v in enumerate(grid['opd_mm']) if v is not None]
    stride=max(1,len(selected)//257)
    for k,i in enumerate(selected):
        xy=np.array(grid['launch_xy_mm'][i]);q,d,opl,_=ref.trace(xy,angle,clip=True);point,path=sphere(q,d,opl,image,radius);normal=(image-point)/radius
        opd=path-chief_opl;worst_opd=max(worst_opd,abs(opd-grid['opd_mm'][i]));worst_map=max(worst_map,float(np.max(np.abs(point-grid['sphere_points_mm'][i]))))
        amplitude=grid['amplitude'][i]
        if k%stride==0:
            jac=np.empty((2,2));step=2e-5
            for axis in range(2):
                plus=xy.copy();minus=xy.copy();plus[axis]+=step;minus[axis]-=step
                qp,dp,op,_=ref.trace(plus,angle);qm,dm,om,_=ref.trace(minus,angle)
                jac[:,axis]=(sphere(qp,dp,op,image,radius)[0][:2]-sphere(qm,dm,om,image,radius)[0][:2])/(2*step)
            own=math.sqrt(math.cos(angle)/abs(np.linalg.det(jac))*normal[2]/np.dot(normal,d))
            worst_amplitude=max(worst_amplitude,abs(own-amplitude))
        normals.append(normal);phases.append(opd);nd.append(np.dot(normal,d));amplitudes.append(amplitude)
    assert worst_opd<1e-6 and worst_map<1e-6 and worst_amplitude<1e-5
    print(json.dumps(dict(stage='independent_pupil',angle_deg=math.degrees(angle),samples=len(selected),max_opd_mm=worst_opd,max_amplitude_error=worst_amplitude)),flush=True)
    normal=np.array(normals);phase=np.array(phases)/ (587.5618e-6);nd=np.array(nd);amplitude=np.array(amplitudes);n=w['size'];pixel=w['pixel_um']/1000;lam=587.5618e-6
    # Full flat-detector diffraction integral, independently vectorized by NumPy.
    out=np.empty(n*n);positions=np.arange(n*n);xx=(positions%n-n/2)*pixel;yy=(positions//n-n/2)*pixel
    for start_block in range(0,n*n,24):
        sl=slice(start_block,min(start_block+24,n*n));dx=xx[sl];dy=yy[sl];delta2=dx*dx+dy*dy
        dot=normal[:,0,None]*dx+normal[:,1,None]*dy
        length=np.sqrt(radius**2+2*radius*dot+delta2)
        path=(2*radius*dot+delta2)/(length+radius)
        kernel=amplitude[:,None]*(nd[:,None]+(radius+dot)/length)/2/normal[:,2,None]*radius/length
        field=np.sum(kernel*np.exp(2j*np.pi*(phase[:,None]+path/lam)),axis=0)
        out[sl]=abs(field)**2
    out=out.reshape(n,n);out/=out.sum();expected=np.array(w['psf']).reshape(n,n)
    otf=np.fft.fft2(out);mtf=abs(otf)/abs(otf[0,0])
    error=max(np.max(abs(mtf[0,:n//2+1]-w['mtf_sagittal'])),np.max(abs(mtf[:n//2+1,0]-w['mtf_tangential'])))
    l1=float(abs(out-expected).sum());assert error<1e-5 and l1<1e-5,(error,l1)
    return dict(angle_deg=math.degrees(angle),reference='RayOptics geometry + NumPy direct scalar Kirchhoff / complex OTF',pupil_samples=len(selected),max_opd_error_mm=worst_opd,max_sphere_intersection_error_mm=worst_map,max_stratified_amplitude_error=worst_amplitude,amplitude_reference_samples=math.ceil(len(selected)/stride),psf_l1_error=l1,mtf_max_absolute_error=float(error),image_pixel_um=w['pixel_um'],convergence=w['quality'],elapsed_seconds=time.perf_counter()-start)

def legacy_projection(new,old):
    if isinstance(old,dict):return {k:legacy_projection(new[k],v) for k,v in old.items()}
    if isinstance(old,list):assert len(new)==len(old);return [legacy_projection(a,b) for a,b in zip(new,old)]
    return new

if __name__=='__main__':
    p=read('examples/35mm-coverage.oos.json')
    old=copy.deepcopy(p);old.pop('field_spec');old['fields']=[0.,.07,.1];old['name']='Legacy narrow-field report'
    wide=copy.deepcopy(old);wide['fields']=[0.,math.radians(32),math.radians(40),-math.radians(40)];wide['name']='Wide-angle ±40 degree singlet'
    geo=[geometry(p),geometry(old),geometry(wide)];print(json.dumps(dict(stage='geometry',results=geo)),flush=True)
    assert geo[0]['coverage']['checkpoints'][2]['status']=='sampled_clear'
    assert geo[1]['coverage']['max_tested_height_mm']<4 and geo[1]['coverage']['checkpoints'][2]['status']=='untested'
    fixed=call('aperture_scan',p,aperture_options=dict(f_numbers=[35,50],refocus=False,sampling=17,mtf=False))
    for point in fixed['points']:
        assert all(c['status']=='sampled_clear' for c in point['coverage']['checkpoints'])
        assert point['coverage']['focus_condition']=='common_flat_sensor'
    original=read('examples/400mm-repaired.oos.json');a=call('analyze',original,sampling=65)
    assert sum(s['failed'] for s in a['spots'])==0
    for actual,expected in zip(a['fields'],[9.2310806427,7.5548313127,14.1052193417]):assert abs(actual['polychromatic_rms_um']-expected)<1e-7
    saved=read('docs/fixtures/design-ui-saved-0.8.oos.json')['workspace']['aperture_scan']
    reproduced=call('aperture_scan',saved['source'],aperture_options=saved['options'])
    assert legacy_projection(reproduced,saved)==saved
    wave=[diffraction(p,math.radians(angle)) for angle in [32,40]]
    original_path=os.environ.get('OOS_ORIGINAL_PROJECT')
    original_hash=hashlib.sha256(Path(original_path).read_bytes()).hexdigest() if original_path else None
    report=dict(version='0.9.0',date='2026-10-19',references=dict(rayoptics=version('rayoptics'),numpy=version('numpy'),scipy=version('scipy')),scope=__doc__,geometry=geo,diffraction=wave,height_mode_fixed_scan=fixed,legacy_400mm_dense_rays=sum(s['sampled'] for s in a['spots']),legacy_400mm_rms_unchanged=True,ui_saved_0_8_scan_all_legacy_fields_identical=True,original_user_sha256=original_hash)
    (ROOT/'docs/validation-coverage-0.9.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps(dict(stage='complete',diffraction=wave)),flush=True)
