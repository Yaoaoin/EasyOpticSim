"""Release CLI end-to-end timings, including process start and JSON transfer."""
import json,os,platform,subprocess,time,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/'target'/'release'/('oos-cli.exe' if os.name=='nt' else 'oos-cli')
projects=json.loads(subprocess.check_output([str(CLI),'examples'],encoding='utf-8'))
p=projects[0]
# 20 physical sequential surfaces: teaching singlet + 17 air planes.
gap=p['surfaces'][-1]['thickness']/18
p['surfaces'][-1]['thickness']=gap
for i in range(17):
    p['surfaces'].append(dict(name=f'Air plane {i}',curvature=0.,conic=0.,asphere=[0.]*4,thickness=gap,semi_aperture=20.,material=0))
report={'platform':platform.platform(),'processor':platform.processor(),'logical_cpus':os.cpu_count(),'surface_count':20,'includes':'process startup, ray aiming, analysis and JSON output','measurements':[]}
for sampling in [7,37]:
    times=[];result=None
    payload=json.dumps(dict(operation='analyze',project=p,sampling=sampling))
    for _ in range(5):
        start=time.perf_counter();r=subprocess.run([str(CLI),'--request'],input=payload,capture_output=True,text=True,encoding='utf-8',check=True);times.append((time.perf_counter()-start)*1000);result=json.loads(r.stdout)
    report['measurements'].append(dict(grid=sampling,ray_count=sum(s['sampled'] for s in result['spots']),median_ms=statistics.median(times),max_ms=max(times)))
out=ROOT/'docs'/'benchmark.json';out.write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
