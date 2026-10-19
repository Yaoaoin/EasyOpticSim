"""Original two-positive-group teaching zoom, Apache-2.0. Not a product prescription.
Independent paraxial matrices set 24/35/50/70 mm at d-line with fixed sensor.
The shared shapes are scaled from the project's synthetic doublet teaching model.
"""
import copy
import json
import math
from pathlib import Path
import numpy as np
from scipy.optimize import brentq

ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / 'examples/doublet.oos.json').read_text(encoding='utf-8'))

def index(m):
    if m['sellmeier'] is None:
        return m['n']
    b, c = m['sellmeier']; l2 = (587.5618 / 1000) ** 2
    return math.sqrt(1 + sum(bi * l2 / (l2-ci) for bi, ci in zip(b, c)))

def matrix(surfaces):
    m = np.eye(2); n = 1.
    for i, s in enumerate(surfaces):
        n2 = index(source['materials'][s['material']])
        m = np.array([[1., 0.], [-(n2-n)*s['curvature'], 1.]]) @ m
        n = n2
        if i + 1 < len(surfaces):
            m = np.array([[1., s['thickness']/n], [0., 1.]]) @ m
    return m

def group(focal):
    s = copy.deepcopy(source['surfaces'][1:])
    original = [v['curvature'] for v in s]
    def power(factor):
        for v, c in zip(s, original):
            v['curvature'] = c * factor
            v['semi_aperture'] = 6.
        return -matrix(s)[1, 0]
    factor = brentq(lambda f: power(f)-1/focal, .01, 4.)
    power(factor)
    return s

def main():
    front, back = group(120.), group(25.)
    # Narrow entrance pupil and 4 x 3 mm sensor make this a deliberately modest
    # teaching model. Wide-angle/full-frame correction is outside its scope.
    front[0]['semi_aperture'] = 1.2
    front[0]['mechanical'] = {'semi_diameter': 6., 'shape': 'flat'}
    p = {**copy.deepcopy(source), 'schema_version': 3,
         'name': '24–70 mm · 双镜组教学变焦',
         'description': '本项目原创 Apache-2.0 教学处方；两正双胶合镜组移动实现 24–70 mm，固定传感器。非商业镜头复刻，4×3 mm 小传感器、小光圈；不代表全画幅或 f/2.8 画质。配置焦距按 d 线近轴矩阵构造，需检查真实光斑与通光；线性插值不保证齐焦。',
         'sensor': [4., 3.], 'fields': [0., .015, .02, .025],
         'field_spec': {'mode': 'sensor'},
         'surfaces': front + back, 'stop': 0}
    records = []
    for focal in [24., 35., 50., 70.]:
        def evaluate(gap):
            p['surfaces'][2]['thickness'] = gap
            m = matrix(p['surfaces'])
            return -1/m[1, 0], -m[0, 0]/m[1, 0]
        gap = brentq(lambda g: 1/evaluate(g)[0]-1/focal, .1, 150.)
        efl, bfl = evaluate(gap)
        assert bfl > 0
        records.append((focal, gap, bfl))
    _, reference_gap, reference_back = records[-1]
    p['surfaces'][2]['thickness'] = reference_gap
    p['surfaces'][5]['thickness'] = reference_back
    for i, s in enumerate(p['surfaces']):
        s['name'] = f'G{1 if i < 3 else 2} · {s["name"]}'
    sensor = sum(s['thickness'] for s in p['surfaces'])
    configurations = []
    for focal, gap, bfl in records:
        rear_shift = reference_back - bfl
        front_shift = rear_shift + reference_gap - gap
        configurations.append(dict(id=f'zoom-{int(focal)}', name=f'{int(focal)} mm',
            positions_mm=[front_shift, rear_shift], object_distance=None,
            target_efl_mm=focal, target_f_number=None))
    groups = [dict(id='variator', name='前组 / 变倍组', start=0, end=2, min_mm=-2., max_mm=90., locked=False),
              dict(id='compensator', name='后组 / 补偿组', start=3, end=5, min_mm=-40., max_mm=5., locked=False)]
    reference = copy.deepcopy(p)
    p['workspace'] = dict(schema_version=1, versions=[], groups=[{k:g[k] for k in ['id','name','start','end']} for g in groups],
        motion=dict(schema_version=1, reference=reference, groups=groups, configurations=configurations,
                    active_id='zoom-70', min_air_mm=.05, sampling=17, criterion='balanced', max_rms_um=30.))
    (ROOT/'examples/24-70mm-zoom.oos.json').write_text(json.dumps(p,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(dict(sensor_reference_mm=sensor, configurations=configurations), ensure_ascii=True))

if __name__ == '__main__':
    main()
