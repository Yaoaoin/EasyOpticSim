"""Generate the original geometric OSS aperture icon; Pillow required."""
from pathlib import Path
from math import sin, cos, pi
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1] / 'src-tauri' / 'icons'
root.mkdir(parents=True, exist_ok=True)
im = Image.new('RGBA', (256, 256), (20, 27, 34, 255))
d = ImageDraw.Draw(im)
d.ellipse((34, 34, 222, 222), outline=(197, 231, 158, 255), width=10)
for i in range(6):
    a = i*pi/3
    start = (128 + 88*cos(a), 128 + 88*sin(a))
    end = (128 + 43*cos(a+1.5), 128 + 43*sin(a+1.5))
    d.line([start, end], fill=(197, 231, 158, 255), width=8)
im.save(root / 'icon.png')
im.save(root / 'icon.ico', sizes=[(16,16),(32,32),(48,48),(64,64),(128,128),(256,256)])
