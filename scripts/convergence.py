"""Record geometric sampling convergence; no claim of universal convergence."""
import json,subprocess,os
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
exe=ROOT/'target'/'release'/('oos-cli.exe' if os.name=='nt' else 'oos-cli')
project=json.loads((ROOT/'examples'/'singlet.oos.json').read_text(encoding='utf-8'))
def run(op,**kw):return json.loads(subprocess.check_output([str(exe),'--request'],input=json.dumps(dict(operation=op,project=project,**kw)),encoding='utf-8'))
project=run('autofocus')['project']
data=[]
for n in [9,17,33,65]:
    a=run('analyze',sampling=n)
    data.append(dict(grid=n,per_field_polychromatic_rms_um=[f['polychromatic_rms_um'] for f in a['fields']],rays=sum(s['sampled'] for s in a['spots'])))
delta=[abs(a-b)/b for a,b in zip(data[-2]['per_field_polychromatic_rms_um'],data[-1]['per_field_polychromatic_rms_um'])]
report=dict(scope='Focused synthetic singlet; geometric RMS only',samples=data,relative_change_33_to_65=delta,acceptance_limit=0.03,passed=max(delta)<0.03)
(ROOT/'docs'/'convergence.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
assert report['passed'], 'Sampling convergence gate failed'
