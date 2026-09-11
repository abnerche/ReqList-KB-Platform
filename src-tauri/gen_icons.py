import struct, zlib, os

OUT = os.path.join(os.path.dirname(__file__), "icons")
os.makedirs(OUT, exist_ok=True)

# 主色：深蓝 (46,92,138)
RGB = (46, 92, 138)


def png_chunk(tag, data):
    chunk = tag + data
    return struct.pack(">I", len(data)) + chunk + struct.pack(">I", zlib.crc32(chunk) & 0xFFFFFFFF)


def make_png(size, path):
    w = h = size
    raw = bytearray()
    for _ in range(h):
        raw.append(0)  # filter type 0 (None)
        for _ in range(w):
            raw += bytes(RGB) + b"\xff"  # RGBA, 不透明
    compressed = zlib.compress(bytes(raw), 9)
    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)  # 8-bit, RGBA
    png = (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", compressed)
        + png_chunk(b"IEND", b"")
    )
    with open(path, "wb") as f:
        f.write(png)
    return png


def make_ico(path, pngs):
    entries = []
    data = b""
    offset = 6 + 16 * len(pngs)
    for png in pngs:
        w = struct.unpack(">I", png[16:20])[0]
        h = struct.unpack(">I", png[20:24])[0]
        w8 = w if w < 256 else 0
        h8 = h if h < 256 else 0
        entry = bytes([w8, h8, 0, 0]) + struct.pack("<HH", 1, 32) + struct.pack("<II", len(png), offset)
        entries.append(entry)
        data += png
        offset += len(png)
    header = struct.pack("<HHH", 0, 1, len(pngs))
    with open(path, "wb") as f:
        f.write(header + b"".join(entries) + data)


if __name__ == "__main__":
    p32 = make_png(32, os.path.join(OUT, "32x32.png"))
    p128 = make_png(128, os.path.join(OUT, "128x128.png"))
    p256 = make_png(256, os.path.join(OUT, "128x128@2x.png"))
    make_ico(os.path.join(OUT, "icon.ico"), [p256, p32])
    print("icons generated:", os.listdir(OUT))
