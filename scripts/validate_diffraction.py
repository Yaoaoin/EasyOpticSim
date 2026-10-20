"""Independent diffraction regression: RayOptics trajectories + reference sphere,
NumPy FFT/complex OTF, direct spherical propagation, and image convolution.
All accepted rays are retraced; OSS supplies the sampling origins and mask.
This validates the documented uniform projected-pupil scalar model, not vector optics.
"""
import argparse
import copy
import json
import math
from pathlib import Path
import subprocess
import time
from importlib.metadata import version
from decimal import Decimal, localcontext

import numpy as np
from scipy.special import j1
from rayoptics.elem.profiles import Spherical, EvenPolynomial
from rayoptics.raytr.raytrace import bend

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("--cli", type=Path, default=ROOT / "target/release/easyopticsim-cli.exe")
parser.add_argument("--extra-project",type=Path)
parser.add_argument("--output",type=Path)
args = parser.parse_args()
CLI = args.cli.resolve()

def invoke(operation, project, **extras):
    r = subprocess.run([str(CLI), "--request"], input=json.dumps(dict(operation=operation, project=project, **extras)),
                       text=True, encoding="utf-8", capture_output=True)
    if r.returncode:
        raise RuntimeError(r.stderr)
    return json.loads(r.stdout)

def material(m, nm):
    if m["sellmeier"] is None:
        return m["n"]
    b, c = m["sellmeier"]
    l2 = (nm / 1000)**2
    return math.sqrt(1 + sum(bi*l2/(l2-ci) for bi, ci in zip(b, c)))

def profiles(p):
    return [EvenPolynomial(c=s["curvature"], cc=s["conic"], coefs=[0., *s["asphere"]])
            if s["conic"] or any(s["asphere"]) else Spherical(c=s["curvature"]) for s in p["surfaces"]]

def exit_pupil_z(p, nm):
    # Independent paraxial ABCD using slope rather than reduced-angle coordinates.
    m = np.eye(2)
    n = 1.
    z = 0.
    last_z = 0.
    for i, s in enumerate(p["surfaces"]):
        n2 = material(p["materials"][s["material"]], nm)
        if i >= p["stop"]:
            m = np.array([[1., 0.], [(n-n2)*s["curvature"]/n2, n/n2]]) @ m
            if i < len(p["surfaces"])-1:
                m = np.array([[1., s["thickness"]], [0., 1.]]) @ m
        n = n2
        last_z = z
        z += s["thickness"]
    return last_z - m[0, 1]/m[1, 1]

def trace(p, prof, xy, nm, field):
    z0 = min(0., *(prof[0].sag(0., p["surfaces"][0]["semi_aperture"]*i/32) for i in range(33))) - .5
    q = np.array([*xy, z0])
    obj = p["object_distance"]
    if obj is None:
        d = np.array([0., math.sin(field), math.cos(field)])
        incoming = q[1]*math.sin(field)
    else:
        d = q - np.array([0., -obj*math.tan(field), -obj])
        length = np.linalg.norm(d)
        d /= length
        # Independent 50-digit distance subtraction, avoiding the Rust rationalization.
        with localcontext() as ctx:
            ctx.prec = 50
            xx, yy, zz = (Decimal.from_float(float(v)) for v in q)
            lateral = Decimal.from_float(obj*math.tan(field))
            axial = Decimal.from_float(obj)+zz
            incoming = float((xx*xx+(yy+lateral)**2+axial**2).sqrt()-(lateral**2+axial**2).sqrt())
    opl = incoming
    z = 0.
    n = 1.
    for s, pr in zip(p["surfaces"], prof):
        local = q - np.array([0., 0., z])
        shift = -local @ d
        dt, hit = pr.intersect(local + shift*d, d, eps=1e-12, z_dir=1)
        opl += n*(shift+dt)
        # Every exported aperture sample must also be physically clear in RayOptics.
        assert np.linalg.norm(hit[:2]) <= s["semi_aperture"]+1e-7
        q = hit + np.array([0., 0., z])
        n2 = material(p["materials"][s["material"]], nm)
        d = bend(d, pr.normal(hit), n, n2)
        n = n2
        z += s["thickness"]
    image = q + ((z-q[2])/d[2])*d
    return q, d, opl, image

def sphere_intercept(exit, direction, opl, image, radius):
    # Polynomial root rather than the Rust solver's closed-form expression.
    roots = np.roots([1., 2.*np.dot(exit-image, direction), np.dot(exit-image, exit-image)-radius**2])
    assert np.all(np.isreal(roots))
    t = float(np.min(roots))
    return exit+t*direction, opl+t

def check_case(name, p, field_index=0, nm=None):
    opts = dict(field_index=field_index, wavelength_nm=nm, max_pupil_samples=256)
    start = time.perf_counter()
    w = invoke("wave", p, wave_options=opts)
    bundle = invoke("pupils", p, sampling=w["quality"]["pupil_sampling"], wave_options=opts)
    n = w["size"]
    assert n == bundle["fft_size"]
    pitch_image = w["pixel_um"] / 1000.
    common_image = np.array([*bundle["reference_image_mm"], sum(s["thickness"] for s in p["surfaces"])])
    total = np.zeros((n, n))
    independent_bands = []
    worst_opd = worst_mapping = worst_reference = 0.
    count = 0
    prof = profiles(p)
    for weight, grid in bundle["bands"]:
        nm_band, field = grid["wavelength_nm"], grid["field"]
        lam = nm_band*1e-6
        m = grid["size"]
        mid = (m//2)*m+m//2
        xy = grid["launch_xy_mm"][mid]
        assert xy is not None
        q, d, opl, image = trace(p, prof, xy, nm_band, field)
        xp = exit_pupil_z(p, nm_band)
        centre = q+(xp-q[2])/d[2]*d
        radius = np.linalg.norm(image-centre)
        _, chief_opl = sphere_intercept(q, d, opl, image, radius)
        worst_reference = max(worst_reference, abs(radius-grid["reference_radius_mm"]),
                              np.max(np.abs(image-grid["reference_image_mm"])), abs(chief_opl-grid["reference_opl_mm"]))
        data = np.zeros((n, n), dtype=complex)
        coords, opds = [], []
        for i, xy in enumerate(grid["launch_xy_mm"]):
            if xy is None:
                continue
            q, d, opl, image_hit = trace(p, prof, xy, nm_band, field)
            point, path = sphere_intercept(q, d, opl, image, radius)
            opd = path-chief_opl
            worst_opd = max(worst_opd, abs(opd-grid["opd_mm"][i]))
            x, y = i % m-m//2, i//m-m//2
            target = centre[:2]+np.array([x, y])*grid["pitch_mm"]
            worst_mapping = max(worst_mapping, float(np.max(np.abs(point[:2]-target))))
            tilt = (np.array([x, y])*grid["pitch_mm"]) @ (image-common_image)[:2]/radius
            data[y+n//2, x+n//2] = np.exp(2j*np.pi*(opd+tilt)/lam)
            coords.append(point)
            opds.append(opd)
            count += 1
        intensity = np.abs(np.fft.fftshift(np.fft.fft2(data)))**2
        intensity /= intensity.sum()
        total += weight*intensity
        independent_bands.append((weight, np.array(coords), np.array(opds), image, radius, lam, len(coords)))
    expected = np.array(w["psf"]).reshape(n, n)
    psf_l1 = float(np.abs(expected-total).sum())
    otf = np.fft.fft2(total)
    mtf = np.abs(otf)/abs(otf[0, 0])
    mtf_error = max(float(np.max(np.abs(mtf[0, :n//2+1]-w["mtf_sagittal"]))),
                    float(np.max(np.abs(mtf[:n//2+1, 0]-w["mtf_tangential"]))))
    # Direct local spherical propagation on the same projected-pupil amplitude
    # measure. Compare sampled intensity at the centre and around the PSF peak.
    peak = np.unravel_index(np.argmax(total), total.shape)
    positions = set((peak[1]-n//2+dx, peak[0]-n//2+dy) for dx in range(-12, 13, 3) for dy in range(-12, 13, 3))
    positions.update([(0, 0), (8, 0), (0, 8), (-8, 0), (0, -8)])
    direct_error = 0.
    for dx, dy in positions:
        target = common_image+np.array([dx*pitch_image, dy*pitch_image, 0.])
        power = 0.
        for weight, coords, opds, image, radius, lam, samples in independent_bands:
            distances = np.linalg.norm(target-coords, axis=1)
            # Magnitude omits common phase; uniform projected-pupil amplitudes.
            amplitude = np.exp(2j*np.pi*(opds+distances-radius)/lam).sum()
            power += weight*abs(amplitude)**2/(n*n*samples)
        direct_error = max(direct_error, abs(power-total[dy+n//2, dx+n//2])/total.max())
    assert worst_reference < 1e-7, worst_reference
    assert worst_opd < 1e-7, worst_opd
    assert worst_mapping < 1e-7, worst_mapping
    assert psf_l1 < 1e-5, psf_l1
    assert mtf_error < 1e-5, mtf_error
    assert direct_error < .01, direct_error
    return dict(name=name, rays=count, spectrum=w["bands"], quality=w["quality"], pixel_um=w["pixel_um"],
                max_reference_error_mm=float(worst_reference), max_opd_error_mm=float(worst_opd),
                max_inverse_mapping_error_mm=float(worst_mapping), psf_l1_error=psf_l1,
                mtf_max_absolute_error=mtf_error, direct_spherical_intensity_error_relative_to_peak=float(direct_error),
                elapsed_seconds=round(time.perf_counter()-start, 3))

def airy():
    n, radius = 1024, 128.
    y, x = np.indices((n, n))-n//2
    disk = (x*x+y*y <= radius*radius).astype(float)
    psf = abs(np.fft.fftshift(np.fft.fft2(disk)))**2
    psf /= psf.max()
    u = 2*np.pi*radius*np.arange(40)/n
    exact = np.ones_like(u); exact[1:] = (2*j1(u[1:])/u[1:])**2
    psf_error = float(max(abs(psf[n//2, n//2:n//2+40]-exact)))
    otf = abs(np.fft.fft2(psf)); otf /= otf[0, 0]
    nu = np.arange(257)/256.
    analytic = 2/np.pi*(np.arccos(nu)-nu*np.sqrt(1-nu*nu))
    error = float(max(abs(otf[0, :257]-analytic)))
    assert error < .01 and psf_error < .001
    return dict(mtf_max_absolute_error=error, airy_peak_normalized_intensity_max_error=psf_error)

def image_check(p):
    # Compare all displayed pixels with a separately constructed target and
    # NumPy convolution, including native-grid integration and display binning.
    p = copy.deepcopy(p); p["fields"] = [0.]
    w = invoke("wave", p)
    result = invoke("preview", p, pattern="resolution")
    assert not result["failures"]
    frame = result["frames"][0]
    n = w["size"]
    y, x = np.indices((n, n))
    source = np.zeros((n, n))
    for j in range(4):
        yy = (y+(j+.5)/4)/n
        freq = np.where(yy < 1/3, 8, np.where(yy < 2/3, 16, 32))
        for i in range(4):
            xx = (x+(i+.5)/4)/n
            source += (.5+.4*np.cos(2*np.pi*freq*xx))/16
    psf = np.array(w["psf"]).reshape(n, n)
    image = np.fft.ifft2(np.fft.fft2(source)*np.fft.fft2(np.fft.ifftshift(psf))).real
    def display(a):
        return np.floor(np.clip(a.reshape(256, n//256, 256, n//256).mean(axis=(1, 3)), 0, 1)*255+.5).astype(int)
    source_error = int(abs(display(source)-np.array(frame["source"]).reshape(256, 256)).max())
    image_error = int(abs(display(image)-np.array(frame["image"]).reshape(256, 256)).max())
    assert source_error <= 1 and image_error <= 1
    assert abs(image.mean()-source.mean()) < 1e-12
    return dict(display_pixels=256**2, source_max_error_8bit=source_error, image_max_error_8bit=image_error,
                mean_energy_error=float(abs(image.mean()-source.mean())))

def main():
    examples = json.loads(subprocess.check_output([str(CLI), "examples"], encoding="utf-8"))
    cases = []
    p = copy.deepcopy(examples[0]); p["surfaces"][p["stop"]]["semi_aperture"] = 2.
    p["fields"] = [0., .05]
    p = invoke("autofocus", p)["project"]
    cases.append(("singlet_axis_stopped", p, 0, 587.5618))
    q = copy.deepcopy(examples[1]); q["fields"] = [0., .05]
    q = invoke("autofocus", q)["project"]
    cases.append(("doublet_offaxis_polychromatic", q, 1, None))
    a = copy.deepcopy(q); a["object_distance"] = 1000.
    a["surfaces"][1]["conic"] = -.5; a["surfaces"][1]["asphere"][0] = 1e-6
    a = invoke("autofocus", a)["project"]
    cases.append(("finite_asphere_offaxis", a, 1, 587.5618))
    far = copy.deepcopy(q); far["object_distance"] = 1e12
    cases.append(("distant_finite_object", far, 1, 587.5618))
    c = copy.deepcopy(p); c["surfaces"][1]["semi_aperture"] = 1.2
    cases.append(("clipped_singlet_axis", c, 0, 587.5618))
    extra=json.loads(args.extra_project.read_text(encoding="utf-8-sig")) if args.extra_project else None
    if extra:
        for field in range(len(extra["fields"])):cases.append((f"repaired_400mm_field_{field}",extra,field,None))
    results = []
    for name, model, field, nm in cases:
        row = check_case(name, model, field, nm); results.append(row)
        print(name, "OPD mm", row["max_opd_error_mm"], "MTF", row["mtf_max_absolute_error"], flush=True)
    report = dict(reference=dict(rayoptics=version("rayoptics"), numpy=version("numpy"), scipy=version("scipy")),
                  scope="Uniform projected-reference-sphere scalar diffraction. All exported ray origins independently retraced with RayOptics; shared pupil mask. Direct spherical comparison uses same amplitude measure, omits radiometry/vector optics.",
                  thresholds=dict(opd_mm=1e-7, mapping_mm=1e-7, psf_l1=1e-5, mtf_absolute=1e-5, spherical_intensity_relative_peak=.01),
                  airy=airy(), lens_cases=results, image=image_check(q))
    if extra:report["repaired_image"]=image_check(extra)
    output = args.output or ROOT/"docs/validation-diffraction.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print("PASS", output, flush=True)

if __name__ == "__main__":
    main()

