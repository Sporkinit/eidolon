#!/usr/bin/env python3
"""
convert_anim_webp.py
====================
Converts per-creature frame folders into animated WebP files.

Expected input layout:
  frames/
    aquajell/
      1.webp  (or 01.webp, frame_1.webp — any name, sorted alphabetically)
      2.webp
      3.webp
    ashwhisker/
      1.webp
      ...

Output:
  side_battle/aquajell_anim.webp
  side_battle/ashwhisker_anim.webp
  ...

Requirements:
  pip install Pillow
  (ffmpeg is NOT required — Pillow handles WebP assembly natively)

Usage:
  python convert_anim_webp.py
  python convert_anim_webp.py --frames frames --output side_battle --fps 8
  python convert_anim_webp.py --fps 6 --loop 0   (loop=0 means infinite)
"""

import argparse
import os
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow not found. Install it with:  pip install Pillow")
    sys.exit(1)


def convert_creature(name: str, frame_paths: list[Path], output_path: Path,
                     frame_duration_ms: int, loop: int) -> None:
    frames = []
    for fp in frame_paths:
        img = Image.open(fp).convert("RGBA")
        frames.append(img)

    if not frames:
        print(f"  [skip] {name} — no frames loaded")
        return

    first = frames[0]
    rest  = frames[1:]

    first.save(
        output_path,
        format="WEBP",
        save_all=True,
        append_images=rest,
        duration=frame_duration_ms,   # ms per frame
        loop=loop,                    # 0 = infinite
        quality=85,
        method=4,
    )
    print(f"  [ok]   {name} → {output_path.name}  "
          f"({len(frames)} frames @ {frame_duration_ms}ms each)")


def main():
    parser = argparse.ArgumentParser(description="Batch convert frames → animated WebP")
    parser.add_argument("--frames",  default="frames",      help="Input folder containing per-creature subfolders")
    parser.add_argument("--output",  default="side_battle", help="Output folder (same as your static sprites)")
    parser.add_argument("--fps",     type=float, default=8, help="Frames per second (default: 8)")
    parser.add_argument("--loop",    type=int,   default=0, help="Loop count, 0 = infinite (default: 0)")
    parser.add_argument("--only",    nargs="*",             help="Only process these creature names (optional)")
    args = parser.parse_args()

    frames_dir = Path(args.frames)
    output_dir = Path(args.output)
    frame_ms   = int(1000 / args.fps)

    if not frames_dir.is_dir():
        print(f"Error: frames directory '{frames_dir}' not found.")
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    # Supported frame extensions
    EXTS = {".webp", ".png", ".jpg", ".jpeg"}

    creatures = sorted(frames_dir.iterdir())
    if args.only:
        only_set = {n.lower() for n in args.only}
        creatures = [c for c in creatures if c.name.lower() in only_set]

    if not creatures:
        print("No creature folders found.")
        sys.exit(0)

    print(f"Converting {len(creatures)} creature(s) at {args.fps} fps "
          f"({frame_ms}ms/frame) → {output_dir}/")
    print()

    ok = 0
    skipped = 0
    for creature_dir in creatures:
        if not creature_dir.is_dir():
            continue

        name = creature_dir.name
        frame_files = sorted(
            f for f in creature_dir.iterdir()
            if f.suffix.lower() in EXTS
        )

        if not frame_files:
            print(f"  [skip] {name} — no image files in folder")
            skipped += 1
            continue

        out_path = output_dir / f"{name}_anim.webp"
        try:
            convert_creature(name, frame_files, out_path, frame_ms, args.loop)
            ok += 1
        except Exception as e:
            print(f"  [err]  {name} — {e}")
            skipped += 1

    print()
    print(f"Done. {ok} converted, {skipped} skipped.")


if __name__ == "__main__":
    main()
