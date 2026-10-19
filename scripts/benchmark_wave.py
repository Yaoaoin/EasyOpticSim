"""Measure production diffraction/preview throughput; no hardware-independent timing gate."""
import copy,json,os,platform,statistics,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CLI=ROOT/'target/release/oos-cli.exe'
def request(operation,p,**extras):
    payload=json.dumps(dict(operation=operation,project=p,**extras))
    t=time.perf_counter()
    r=subprocess.run([str(CLI),'--request'],input=payload,capture_output=True,text=True,encoding='utf-8')
    return r,1000*(time.perf_counter()-t)
models=json.loads(subprocess.check_output([str(CLI),'examples'],encoding='utf-8'))
results=[]
for i,original in enumerate(models):
    r,_=request('autofocus',original)
    assert r.returncode==0,r.stderr
    p=json.loads(r.stdout)['project']
    for field in [0,2]:
        times=[]; outcome=None
        for _ in range(3):
            r,ms=request('wave',p,wave_options=dict(field_index=field))
            times.append(ms)
            if r.returncode:
                outcome=dict(accepted=False,diagnostic=json.loads(r.stderr)['error'])
            else:
                w=json.loads(r.stdout)
                outcome=dict(accepted=True,quality=w['quality'],fft_size=w['size'],bands=len(w['bands']))
        # Known quality guard: the focused full-aperture singlet edge must fail.
        assert outcome['accepted'] == (i!=0 or field==0)
        results.append(dict(model=original['name'],field_rad=p['fields'][field],median_ms=statistics.median(times),**outcome))
    if i==1:
        times=[]
        for _ in range(3):
            r,ms=request('preview',p,pattern='grid')
            assert r.returncode==0,r.stderr
            preview=json.loads(r.stdout)
            assert len(preview['frames'])==3 and not preview['failures']
            times.append(ms)
        preview_result=dict(model=original['name'],fields=3,bands=3,median_ms=statistics.median(times))
report=dict(version='0.2.0',platform=platform.platform(),processor=platform.processor(),logical_cpus=os.cpu_count(),
            includes='CLI startup, adaptive tracing, FFTs, all bands and full JSON output; three runs per measurement',
            waves=results,preview=preview_result)
(ROOT/'docs/benchmark-wave.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=True,indent=2))

