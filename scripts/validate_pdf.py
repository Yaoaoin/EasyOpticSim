"""Check exported source fidelity, text/searchability, page bounds and render every page."""
import hashlib,json,subprocess,sys,os,shutil
from pathlib import Path
from pypdf import PdfReader
from PIL import Image,ImageOps,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
POPPLER=Path(os.environ.get('OOS_PDFTOPPM') or shutil.which('pdftoppm') or '__pdftoppm_not_found__')
if not POPPLER.is_file():raise RuntimeError('Install Poppler and add pdftoppm to PATH, or set OOS_PDFTOPPM to its executable path.')
generated=json.loads((ROOT/'tmp/pdfs/generation.json').read_text())
production_only='--production-only' in sys.argv
if production_only:
    pdf=ROOT/'output/pdf/400mm-production-UI-1.0.pdf'
    source=PdfReader(pdf).attachments['project.oos.json'][0]
    generated=[{'source':'docs/fixtures/workspace-ui-saved-1.0.oos.json','pdf':str(pdf.relative_to(ROOT)),'bytes':pdf.stat().st_size,'sourceHash':hashlib.sha256(source).hexdigest(),'productionCSP':True}]
reports=[]
for record in generated:
    path=ROOT/record['pdf'];reader=PdfReader(path)
    texts=[p.extract_text() or '' for p in reader.pages];full='\n'.join(texts)
    assert len(reader.pages)>6 and all(t.strip() for t in texts)
    for term in ['完整表面处方','非球面系数','材料快照','视场','几何分离','版本与历史记录','符号']:
        assert term in full,(path,term)
    assert 'project.oos.json' in reader.attachments and 'analysis.json' in reader.attachments
    source=reader.attachments['project.oos.json'][0];project=json.loads(source)
    if record.get('source'):
        original=json.loads((ROOT/record['source']).read_text(encoding='utf-8'))
        assert project==original
        assert hashlib.sha256(source).hexdigest()==record['sourceHash']
        for i,surface in enumerate(project['surfaces']):assert f'S{i+1}' in full
    assert not any('\ufffd' in t for t in texts),'Missing or malformed Unicode'
    # Footer and page title text must stay in printable page area. The document
    # includes vectors and PSF image operators, checked separately by raster review.
    violations=[]
    for index,page in enumerate(reader.pages):
        def visit(text,cm,tm,font,size):
            if text.strip() and (tm[4]<30 or tm[4]>815 or tm[5]<12 or tm[5]>580):violations.append((index+1,text[:60],tm[4:6]))
        page.extract_text(visitor_text=visit)
    assert not violations,violations
    prefix=ROOT/'tmp/pdfs'/path.stem
    for old in prefix.parent.glob(prefix.name+'-*.png'):
        assert old.resolve().is_relative_to((ROOT/'tmp/pdfs').resolve())
        old.unlink()
    subprocess.run([str(POPPLER),'-r','80','-png',str(path),str(prefix)],check=True,capture_output=True)
    pages=sorted(prefix.parent.glob(prefix.name+'-*.png'))
    assert len(pages)==len(reader.pages)
    thumbs=[]
    for i,f in enumerate(pages):
        image=Image.open(f).convert('RGB');image.thumbnail((420,300))
        panel=Image.new('RGB',(440,330),'#dce4e9');panel.paste(image,((440-image.width)//2,15));ImageDraw.Draw(panel).text((15,312),f'Page {i+1}',fill='black');thumbs.append(panel)
    sheet=Image.new('RGB',(440*3,330*((len(thumbs)+2)//3)),'white')
    for i,image in enumerate(thumbs):sheet.paste(image,((i%3)*440,(i//3)*330))
    contact=prefix.parent/(path.stem+'-contact.jpg');sheet.save(contact,quality=88)
    reports.append({**record,'pages':len(reader.pages),'sourceAttachmentExact':True,'textSearchable':True,'textOriginBoundsPassed':True,'allPagesRendered':True,'contactSheet':str(contact.relative_to(ROOT))})
(ROOT/('docs/validation-pdf-production-1.0.json' if production_only else 'docs/validation-pdf-1.0.json')).write_text(json.dumps(reports,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(reports,ensure_ascii=True,indent=2))
