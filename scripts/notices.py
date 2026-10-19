"""Collect dependency metadata and supplied license texts for redistribution."""
import json,subprocess,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
cargo=shutil.which('cargo')
if not cargo:raise SystemExit('cargo must be on PATH; install Rust and reopen the terminal.')
meta=json.loads(subprocess.check_output([str(cargo),'metadata','--locked','--offline','--format-version','1','--filter-platform','x86_64-pc-windows-msvc'],cwd=ROOT,encoding='utf-8'))
blocks=['OpenOpticSim third-party notices\nGenerated from locked Rust dependencies and installed Node packages.\nIncludes build/dev dependencies conservatively. Each component retains its own license.\n']
inventory=[]
seen=set()
def add(name,version,license,folder,license_file=None,source=None,ecosystem=None):
    identity=(name,version,license)
    if identity in seen:return
    seen.add(identity)
    files=[]
    for f in folder.iterdir():
        if f.is_file() and f.name.upper().startswith(('LICENSE','LICENCE','COPYING','COPYRIGHT','NOTICE')):
            files.append(f)
    if license_file:
        f=folder/license_file
        if f.is_file() and f not in files:files.append(f)
    supplements={'alloc-stdlib':'alloc-stdlib-LICENSE.txt','selectors':'selectors-MPL-2.0.txt','webview2-com':'webview2-rs-LICENSE.txt','webview2-com-sys':'webview2-rs-LICENSE.txt','webview2-com-macros':'webview2-rs-LICENSE.txt','@pdf-lib/fontkit':'fontkit-attribution.txt','stackback':'stackback-attribution.txt'}
    if not files and name in supplements:
        f=ROOT/'docs/licenses'/supplements[name]
        if f.is_file():files.append(f)
    # Platform-specific build binaries share their parent distribution's license.
    parents={'@esbuild/':'esbuild','@rollup/':'rollup','@tauri-apps/cli-':'@tauri-apps/cli'}
    if not files:
        for prefix,parent in parents.items():
            if name.startswith(prefix):
                pattern=parent.replace('/','+')+'@*/node_modules/'+parent
                for candidate in (ROOT/'node_modules/.pnpm').glob(pattern):
                    files.extend(f for f in candidate.iterdir() if f.is_file() and f.name.upper().startswith(('LICENSE','LICENCE','COPYING','COPYRIGHT','NOTICE')))
    blocks.append('\n'+'='*72+f'\n{name} {version}\nDeclared license: {license}\nSource: {source or "See dependency lockfile"}\n')
    for f in sorted(files):
        blocks.append('\n--- '+f.name+' ---\n'+f.read_text(encoding='utf-8',errors='replace'))
    inventory.append(dict(name=name,version=version,license=license,texts=[f.name for f in files],source=source,ecosystem=ecosystem))
for pkg in sorted(meta['packages'],key=lambda p:(p['name'],p['version'])):
    if pkg['source'] is not None:
        add(pkg['name'],pkg['version'],pkg.get('license'),Path(pkg['manifest_path']).parent,pkg.get('license_file'),f"https://crates.io/crates/{pkg['name']}/{pkg['version']}",'cargo')
for pkgfile in sorted((ROOT/'node_modules'/'.pnpm').glob('*/node_modules/*/package.json')):
    pkg=json.loads(pkgfile.read_text(encoding='utf-8'));add(pkg['name'],pkg['version'],pkg.get('license'),pkgfile.parent,source=f"https://www.npmjs.com/package/{pkg['name']}/v/{pkg['version']}",ecosystem='npm')
for pkgfile in sorted((ROOT/'node_modules'/'.pnpm').glob('*/node_modules/@*/*/package.json')):
    pkg=json.loads(pkgfile.read_text(encoding='utf-8'));add(pkg['name'],pkg['version'],pkg.get('license'),pkgfile.parent,source=f"https://www.npmjs.com/package/{pkg['name']}/v/{pkg['version']}",ecosystem='npm')
font=ROOT/'src/assets/fonts'
if font.exists():add('Noto Sans SC','2.004; static wght=400','OFL-1.1',font,'OFL.txt','https://github.com/google/fonts/tree/main/ofl/notosanssc','font')
(ROOT/'THIRD_PARTY_NOTICES.txt').write_text('\n'.join(blocks),encoding='utf-8')
(ROOT/'docs'/'dependencies.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
print(f'Collected {len(inventory)} dependency records; {sum(not p["texts"] for p in inventory)} without supplied or supplemental license text; inspect provenance exceptions before public distribution.')
