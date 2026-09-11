from PIL import Image
import os

src = r"E:\claw\2026-08-20-10-40-08\generated-images\A_high_quality_desktop_applica_2026-08-20T08-02-43.png"
out_dir = os.path.dirname(os.path.abspath(__file__))

img = Image.open(src).convert("RGBA")

# 先裁剪为正方形（以中心为准）
w, h = img.size
size = min(w, h)
left = (w - size) // 2
top = (h - size) // 2
img = img.crop((left, top, left + size, top + size))

# 生成 Tauri 所需的 PNG 图标
png_specs = [
    (32, "32x32.png"),
    (128, "128x128.png"),
    (256, "128x128@2x.png"),
]
for s, name in png_specs:
    resized = img.resize((s, s), Image.LANCZOS)
    resized.save(os.path.join(out_dir, name))
    print(f"saved {name} ({s}x{s})")

# 生成多分辨率 ICO（PIL ICO 用 sizes 参数自动内含多尺寸）
ico_sizes = [16, 32, 48, 64, 128, 256]
img.save(
    os.path.join(out_dir, "icon.ico"),
    format="ICO",
    sizes=[(s, s) for s in ico_sizes],
)
print(f"saved icon.ico with sizes {ico_sizes}")
