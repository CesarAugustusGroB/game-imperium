"""Fix UTF-8-as-Windows-1252 mojibake, run by run.

The corruption is classic double-encoding: real UTF-8 bytes were decoded as
cp1252 and re-saved, turning `·`→`Â·`, `día`→`dÃ­a`, `🔒`→`ðŸ”’`, etc.

Files here are MIXED (BOM + some already-correct non-ASCII + mojibake), so a
whole-file re-encode is unsafe. Instead we walk each maximal run of cp1252-range
characters and reverse just that run (encode→cp1252 bytes, decode→utf-8). A run
that isn't valid UTF-8 — e.g. an already-correct standalone `·` (0xB7) or a real
emoji (not cp1252-encodable, so never part of a run) — is left untouched. That
makes the pass safe and idempotent.

Usage:  python tools/fix-mojibake.py            # dry run
        python tools/fix-mojibake.py --write     # apply
"""
import sys
import pathlib

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(__file__).resolve().parent.parent / "src"
WRITE = "--write" in sys.argv
EXTS = {".ts", ".tsx", ".css", ".html"}


# char → originating byte, as the corruption produced it: cp1252 for defined
# bytes, plus latin-1 passthrough for cp1252's 5 undefined bytes (0x81 0x8D
# 0x8F 0x90 0x9D) which appear inside mangled emoji variation-selectors.
CHAR2BYTE = {}
for _b in range(0x80, 0x100):
    try:
        CHAR2BYTE[bytes([_b]).decode("cp1252")] = _b
    except UnicodeDecodeError:
        CHAR2BYTE[chr(_b)] = _b  # passthrough for undefined bytes


def in_range(ch: str) -> bool:
    return ord(ch) >= 0x80 and ch in CHAR2BYTE


def fix(text: str):
    out, i, n, L = [], 0, 0, len(text)
    while i < L:
        if in_range(text[i]):
            j = i
            while j < L and in_range(text[j]):
                j += 1
            run = text[i:j]
            try:
                rev = bytes(CHAR2BYTE[c] for c in run).decode("utf-8")
            except UnicodeDecodeError:
                rev = run
            if rev != run:
                n += 1
            out.append(rev)
            i = j
        else:
            out.append(text[i])
            i += 1
    return "".join(out), n


changed = []
for path in ROOT.rglob("*"):
    if path.suffix not in EXTS or not path.is_file():
        continue
    text = path.read_text(encoding="utf-8")
    fixed, n = fix(text)
    if n == 0 or fixed == text:
        continue
    rel = path.relative_to(ROOT.parent)
    changed.append((rel, n))
    sample = [(idx + 1, b) for idx, (a, b) in enumerate(zip(text.splitlines(), fixed.splitlines())) if a != b][:3]
    print(f"\n=== {rel}  ({n} runs) ===")
    for ln, b in sample:
        print(f"  L{ln}: {b.strip()[:96]}")
    if WRITE:
        path.write_text(fixed, encoding="utf-8")

print("\n--- SUMMARY ---")
print(("FIXED " if WRITE else "would fix ") + f"{len(changed)} files")
for rel, n in changed:
    print(f"   {rel}  ({n} runs)")
