from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
FILES = [ROOT / "assets" / "icon.png", ROOT / "assets" / "adaptive-icon.png"]

for path in FILES:
    img = Image.open(path)
    width, height = img.size
    size = min(width, height)
    left = (width - size) // 2
    top = (height - size) // 2
    cropped = img.crop((left, top, left + size, top + size))
    squared = cropped.resize((1024, 1024), Image.Resampling.LANCZOS)
    squared.save(path)
    print(f"fixed {path.name} -> 1024x1024")
