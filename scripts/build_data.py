#!/usr/bin/env python3
"""Build site/data.js from the CSVs in luigi/ and the roster in reference/monke.gg.

Run:  python3 -I scripts/build_data.py
"""
import csv, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LUIGI = ROOT / "luigi"
OUT = ROOT / "site" / "data.js"


def rows(path):
    with open(path, newline="", encoding="utf-8") as f:
        return [[c.strip() for c in r] for r in csv.reader(f)]


def norm(s):
    return re.sub(r"[^a-z0-9]", "", s.lower().replace("é", "e"))


# ---------------------------------------------------------------- roster
roster = []
for r in rows(ROOT / "reference/monke.gg/data/data.csv")[1:]:
    if not r or not r[0]:
        continue
    roster.append({
        "name": r[0],
        "members": [m.strip() for m in r[1].split(",")] if r[1] else [],
        "shortcuts": [s.strip() for s in r[2].split(",") if s.strip()],
        "sprite": int(r[3]),
    })
# monke's data file has a joke shortcut on Link; drop it.
for c in roster:
    c["shortcuts"] = [s for s in c["shortcuts"] if s not in ("monke.gg", "dogshit", "stupid", "monke", "carried")]
    if c["name"] == "Donkey Kong":
        c["shortcuts"] += ["monke"]

CANON = {norm(c["name"]): c["name"] for c in roster}
ALIASES = {
    "dk": "Donkey Kong", "yink": "Young Link", "tink": "Toon Link", "ddd": "King Dedede",
    "wft": "Wii Fit Trainer", "rosalina": "Rosalina & Luma", "rosaluma": "Rosalina & Luma",
    "plant": "Piranha Plant", "pirahnaplant": "Piranha Plant", "piranhaplant": "Piranha Plant",
    "banjo": "Banjo & Kazooie", "banjokazooie": "Banjo & Kazooie", "terrybogard": "Terry",
    "brawler": "Mii Brawler", "swordfighter": "Mii Swordfighter", "gunner": "Mii Gunner",
    "megaman": "Mega Man", "rob": "R.O.B.", "gamewatch": "Mr. Game & Watch",
    "mrgw": "Mr. Game & Watch", "mrgamewatch": "Mr. Game & Watch", "gw": "Mr. Game & Watch",
    "falcon": "Captain Falcon", "diddy": "Diddy Kong", "zsuitsamus": "Zero Suit Samus",
    "pacman": "Pac-Man", "ness": "Ness", "charitard": "Charizard", "pyra": "Pyra", "mythra": "Mythra",
}
unresolved = set()


def resolve(label):
    """label -> (list of canonical names, variant or None)"""
    label = label.replace("\n", " ").strip()
    low = label.lower()
    if re.fullmatch(r"ste+(ve)?", low):  # the misc sheets spell Steve "Steeeeeeee"
        return ["Steve"], None
    if low.startswith("(dark)"):
        return [n for n in ("Dark " + label[6:].strip(), label[6:].strip()) if norm(n) in CANON], None
    if low.startswith("(ch)"):
        return resolve(label[4:])[0] + ["Chrom"], None
    if "/" in label:
        out = []
        for part in label.split("/"):
            out += resolve(part)[0]
        return out, None
    variant = None
    m = re.match(r"^(.*?)\s*\(([^)]*)\)\s*$", label)
    if m:
        label, variant = m.group(1).strip(), m.group(2).strip()
        if variant.startswith("+"):  # "Cloud(+Limit)": just the base character, annotated
            variant = None
    k = norm(label)
    name = CANON.get(k) or ALIASES.get(k)
    if not name:
        unresolved.add(label)
        return [], variant
    return [name], variant


def rng(s):
    """Tidy a range cell; None when empty."""
    s = s.strip()
    return s or None


# ---------------------------------------------------------------- ZTD
ZTD_COMBOS = [
    {"id": "PC", "name": "Standard ZTD", "seq": "↓throw, dair, ffnair, dair, uair, up b", "group": "long"},
    {"id": "PCZ", "name": "Standard ZTD + Zair", "seq": "↓throw, dair, ffnair, dair, zair, up b", "group": "long"},
    {"id": "DG", "name": "Heavy ZTD (regrab)", "seq": "↓throw, dair, ffnair, regrab, ↓throw, dair, uair/zair, up b", "group": "long"},
    {"id": "UAVS", "name": "Fair ZTD", "seq": "↓throw, fair, ffnair, dair, uair/zair, up b", "group": "long"},
    {"id": "SPC", "name": "Short ZTD", "seq": "↓throw, dair, uair, up b", "group": "short"},
    {"id": "SPCZ", "name": "Short ZTD + Zair", "seq": "↓throw, dair, zair, up b", "group": "short", "inferred": True},
]
IDS = [c["id"] for c in ZTD_COMBOS]


def ztd_tab(path, first_col):
    out = {}
    for r in rows(path)[3:]:
        if not r or not r[0]:
            continue
        cells = r[first_col:first_col + 6]
        data = {i: rng(v) for i, v in zip(IDS, cells) if rng(v)}
        names, _ = resolve(r[0])
        for n in names:
            out[n] = data
    return out


ztd = {
    "singles": ztd_tab(LUIGI / "ztd/ztd-0-death.csv", 2),
    "doubles": ztd_tab(LUIGI / "ztd/ztd-2v2.csv", 1),
}

# random / character-specific combos
rr = rows(LUIGI / "ztd/ztd-random-combos.csv")
RANDOM_DEFS = [
    ("DNUU", "DNUU", "↓throw, dair, nair, uair, uair, up b", 0, 1),
    ("DNFZ", "DNFZ", "↓throw, dair, nair, fair, zair, up b", 3, 4),
    ("Starfall", "Starfall Combo", "↓throw, dair, ffnair, dair, wnair, dair, uair/zair, up b", 6, 7),
    ("Starfall", None, None, 8, 9),
]
random_combos = {}
first = {0: ("Fox", rr[0][1]), 3: ("Fox", rr[0][4]), 6: ("Mario", rr[0][7])}
for cid, label, seq, cn, cr in RANDOM_DEFS:
    entries = []
    if cn in first:
        victim, text = first[cn]
        m = re.search(r"(\d+%?-\d+%.*)$", text)
        entries.append((victim, m.group(1)))
    for r in rr[1:]:
        if len(r) > cr and r[cn] and r[cr]:
            entries.append((r[cn], r[cr]))
    for victim, window in entries:
        for n in resolve(victim)[0]:
            random_combos.setdefault(n, []).append({"combo": cid, "window": window})
ztd["random"] = random_combos
ztd["randomDefs"] = {
    "DNUU": {"name": "DNUU", "seq": RANDOM_DEFS[0][2]},
    "DNFZ": {"name": "DNFZ", "seq": RANDOM_DEFS[1][2]},
    "Starfall": {"name": "Starfall Combo", "seq": RANDOM_DEFS[2][2]},
}
ztd["combos"] = ZTD_COMBOS

# ---------------------------------------------------------------- Project L (grab-to-death plans)
# One tab per character. Each tab holds one or more blocks: a "DI IN" column and a "DI OUT" column
# (window cell on the left of each), either one row per window or, on the header row, several windows
# squeezed into one cell with the sequences concatenated (each sequence ends in "upB").
WIN = re.compile(r"\d+(?:-\d+)?\+?%")
LABELS = {"acceleratle": "Accelerate", "w/ deepbreathing": "Deep Breathing", "bf": "Battlefield"}
PT_BLOCKS = ["Squirtle", "Charizard", "Ivysaur"]  # tab has no labels; order inferred from Up B kill percents


def read_block_side(grid, r0, col, win_col, stop_rows):
    """Read one DI column downward from header row r0. Returns [(window, seq)]."""
    out = []
    hdr_win = grid[r0][win_col] if win_col < len(grid[r0]) else ""
    hdr_seq = re.sub(r"^\s*DI (IN|OUT)\s*", "", grid[r0][col])
    wins = WIN.findall(hdr_win)
    if wins:
        seqs = [x.strip() for x in re.findall(r"(.*?upB)", hdr_seq) if x.strip()]
        if len(seqs) != len(wins):
            print(f"  WARN header mismatch row {r0} col {col}: {len(wins)} windows, {len(seqs)} sequences")
        out += list(zip(wins, seqs))
    empties = 0
    for r in range(r0 + 1, len(grid)):
        if r in stop_rows:
            break
        row = grid[r]
        w = row[win_col].strip() if win_col < len(row) else ""
        q = row[col].strip() if col < len(row) else ""
        if not w:
            empties += 1
            if empties >= 3:
                break
            continue
        if not WIN.fullmatch(w):  # label / link / next block title
            break
        empties = 0
        if q:
            out.append((w, q))
    return out


def parse_project_l(path):
    grid = [[c.strip() for c in r] for r in csv.reader(open(path, newline="", encoding="utf-8"))]
    heads = [(r, c) for r, row in enumerate(grid) for c, v in enumerate(row) if re.match(r"DI IN", v)]
    blocks = []
    for r, c in heads:
        out_c = next((j for j in range(c + 1, min(c + 8, len(grid[r]))) if grid[r][j].startswith("DI OUT")), None)
        label = None
        for rr, cc in ((r, c - 1), (r - 1, c - 1)):
            cell = grid[rr][cc] if rr >= 0 and 0 <= cc < len(grid[rr]) else ""
            txt = WIN.sub("", cell).strip()
            if re.search(r"[A-Za-z]", txt) and not re.search(r"\d", txt):
                label = LABELS.get(txt.lower(), txt)
                break
        same_col_rows = {rr for rr, cc in heads if cc == c and rr > r}
        ins = read_block_side(grid, r, c, c - 1, same_col_rows)
        outs = read_block_side(grid, r, out_c, out_c - 1, {rr for rr, cc in heads if cc == c and rr > r}) if out_c else []
        blocks.append({"label": label, "in": ins, "out": outs, "pos": (r, c)})
    return blocks


def fmt_seq(seq):
    return re.sub(r"\bupB\b", "up B", seq)


plan = {}
PROJECT_L = LUIGI / "ztd/project-l"
for f in sorted(PROJECT_L.glob("*.csv")):
    if f.name.startswith("_"):
        continue
    tab = f.stem
    blocks = parse_project_l(f)
    if not blocks:
        print("  no blocks in", tab)
        continue
    if tab == "Pokemon Trainer":
        targets = list(zip(PT_BLOCKS, [b for b in sorted(blocks, key=lambda b: b["pos"])]))
        targets = [(n, b) for n, b in targets]
    elif tab in ("Pyra", "Mythra"):  # both Aegis tabs show both forms; use the first block for this tab's character
        targets = [(tab, blocks[0])]
    else:
        names, _ = resolve(tab)
        if not names:
            print("  UNRESOLVED tab", tab)
            continue
        targets = [(names[0], b) for b in blocks]
    for name, b in targets:
        def side(lst):
            return [{"w": w, "seq": fmt_seq(q)} for w, q in lst]
        plan.setdefault(name, []).append({"label": b["label"], "in": side(b["in"]), "out": side(b["out"])})

# ---------------------------------------------------------------- other combos
moves = {}


def put(label, move, entry):
    names, variant = resolve(label)
    for n in names:
        e = dict(entry)
        if variant:
            e["variant"] = variant
        moves.setdefault(n, {}).setdefault(move, []).append(e)


def clean(d):
    return {k: v for k, v in d.items() if v}


DIFFICULTY = {"hard": "Hard", "stupid": "Very hard", "fuck z-axis": "Very hard (z-axis)"}

for r in rows(LUIGI / "up-b/Luigi Up-B Stuff & Setups - Dthrow _ Up B.csv")[2:]:
    if not r[0] or not re.search(r"\d", r[1] if len(r) > 1 else ""):
        continue
    r += [""] * 8
    extra = r[4]
    diff = DIFFICULTY.get(extra.lower())
    trap = re.match(r"\d+(\s*-\s*\d+)?", r[5])
    put(r[0], "dthrowUpB", clean({
        "diIn": r[1], "noDI": r[2], "diOut": r[3],
        "difficulty": diff, "note": None if diff else extra,
        "diTrap": trap.group(0) if trap else None, "diReactable": r[6],
    }))

for r in rows(LUIGI / "up-b/Luigi Up-B Stuff & Setups - Utilt _ Up B.csv")[2:]:
    r += [""] * 4
    if not r[0] or not re.search(r"\d", r[1]):
        continue
    put(r[0], "utiltUpB", clean({"range": r[1], "note": r[2] if re.search(r"[A-Za-z]", r[2]) else None}))

for r in rows(LUIGI / "up-b/Luigi Up-B Stuff & Setups - Dtilt _ Up b.csv")[2:]:
    r += [""] * 3
    if not r[0] or not re.search(r"\d", r[1]):
        continue
    cell = r[1]
    fd = None
    m = re.match(r"^\((\d+)-\)\s*(.*)$", cell)  # "(45-)46-48%": FD starts 45, BF 46-48
    if m:
        fd, cell = m.group(1), m.group(2)
    else:
        m = re.match(r"^\((\d+-\d+)\)$", cell)  # "(47-48)"
        if m:
            cell = m.group(1)
    entry = {"range": cell.strip(), "fd": fd}
    if r[2] and not re.search(r"\d", r[2]):
        entry["note"] = r[2]
    put(r[0], "dtiltUpB", clean(entry))
    m = re.match(r"^([\d-]+%?)\s*\(([^)]*)\)$", r[2])  # extra column: "49-63% (Deep Breathing)"
    if m:
        names, _ = resolve(r[0])
        for n in names:
            moves[n]["dtiltUpB"].append({"range": m.group(1), "variant": m.group(2).strip().title()})

for r in rows(LUIGI / "up-b/Luigi Up-B Stuff & Setups - Nair _ Up B.csv")[2:]:
    r += [""] * 5
    if not r[0] or not re.search(r"\d", r[1]):
        continue
    put(r[0], "nairUpB", clean({"kill": r[1], "diIn": r[2], "noDI": r[3], "diOut": r[4]}))

for r in rows(LUIGI / "dthrow-cyclone/Luigi's Mansion - The Data Compendium - DThrow _ Cyclone Confirm Range.csv")[1:]:
    r += [""] * 2
    if r[0] and re.search(r"\d", r[1]):
        put(r[0], "dthrowCyclone", {"range": r[1], "stage": "Final Destination"})

for r in rows(LUIGI / "ztd/Luigi's Mansion - The Data Compendium - Up-B KO Percents.csv")[1:]:
    r += [""] * 7
    if r[0] and re.search(r"\d", r[1]):
        put(r[0], "upBKO", clean({"fd": r[1], "bf": r[2], "rage": {k: v for k, v in zip(("60", "80", "100", "150"), r[3:7]) if v}}))

# character-specific combos: hand-written lists plus the sheet's "random combos" tab
char_specific = {}
for path in sorted((LUIGI / "character-specific").glob("*.json")):
    spec = json.loads(path.read_text(encoding="utf-8"))
    for name, e in spec["entries"].items():
        if name not in CANON.values():
            print("UNKNOWN character in", path.name, ":", name)
        item = {"title": spec["title"], "window": e["window"], "notes": e["notes"]}
        if spec.get("seq"):
            item["seq"] = spec["seq"]
        char_specific.setdefault(name, []).append(item)

# luigi/misc: one column of windows per character ("Dtilt Busted" sheets)
VARIANT_NAMES = {"Oof+Acc": "Oomph + Accel", "Accel": "Accelerate"}
MISC = [("Dtilt Busted - Dtilt _ Fair.csv", "Dtilt → Fair", (2, 3)),
        ("Dtilt Busted - Dtilt _ Uair.csv", "Dtilt → Uair", ())]
for fname, title, note_cols in MISC:
    for r in rows(LUIGI / "misc" / fname)[1:]:
        r += [""] * 5
        if not r[0] or not re.search(r"\d", r[1]):
            continue
        window = " · ".join(seg.strip() for seg in re.split(r"[,|]", r[1]) if seg.strip()).replace("...", "…")
        note = next((r[c] for c in note_cols if re.search(r"[A-Za-z]", r[c])), None)
        names, variant = resolve(r[0])
        for n in names:
            t = title + (f" ({VARIANT_NAMES.get(variant, variant)})" if variant else "")
            char_specific.setdefault(n, []).append(
                {"title": t, "window": window, "notes": [note] if note else []})
for name, lst in ztd["random"].items():
    for e in lst:
        continue  # random-combos tab (DNUU / DNFZ / Starfall) is intentionally not shown
        d = ztd["randomDefs"][e["combo"]]
        char_specific.setdefault(name, []).append({"title": d["name"], "window": e["window"], "notes": [], "seq": d["seq"]})
del ztd["random"], ztd["randomDefs"]

# DThrow tumble percents (0% rage plus a few rage levels)
tumble = {}
trows = rows(LUIGI / "ztd/Luigi's Mansion - The Data Compendium - DThrow Tumble Percents.csv")
rage_cols = [h.split("%")[0] for h in trows[0][2:]]  # "60% Rage" -> "60"
for r in trows[1:]:
    r += [""] * 6
    if not r[0] or not re.search(r"\d", r[1]):
        continue
    names, variant = resolve(r[0])
    entry = {"p": r[1], "rage": {k: v for k, v in zip(rage_cols, r[2:6]) if v}}
    if variant:
        entry["variant"] = variant
    for n in names:
        tumble.setdefault(n, []).append(entry)

# projectiles Luigi can crouch under (gameplans/). Colors in the source sheet are lost in the CSV export.
crouch = {}
for r in rows(LUIGI / "gameplans/Luigi's Mansion - The Data Compendium - Crouchable projectiles.csv")[2:]:
    r += [""]
    label, text = " ".join(r[0].split()), " ".join(r[1].split())
    if not label or not text or text.upper() == "N/A":
        continue
    names = ["Marth", "Lucina"] if label.lower() == "marcina" else resolve(label)[0]
    items = [i.strip() for i in re.split(r",(?![^()]*\))", text) if i.strip()]
    for n in names:
        crouch.setdefault(n, []).extend(items)

# ledge hangs: difficulty is the cell fill color in the "Hitting Ledge Hangs" workbook (not in any CSV export)
import zipfile
import xml.etree.ElementTree as ET

_M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
LEDGE_MOVES = {"C": "Dtilt", "D": "Dtaunt", "E": "Ftilt", "F": "Dsmash", "G": "Fsmash", "L": "Green Missile (misfire)"}
LEDGE_DIFF = {"FF00FF00": "easy", "FFFFFF00": "medium", "FFFF9900": "hard"}  # red = doesn't work (hidden), gray = no data


def read_ledge(path):
    z = zipfile.ZipFile(path)
    styles = ET.fromstring(z.read("xl/styles.xml"))
    fills = []
    for f in styles.find(_M + "fills"):
        pf = f.find(_M + "patternFill")
        fg = pf.find(_M + "fgColor") if pf is not None else None
        fills.append(fg.get("rgb") if pf is not None and pf.get("patternType") == "solid" and fg is not None else None)
    xf_fill = [fills[int(x.get("fillId", 0))] for x in styles.find(_M + "cellXfs")]
    strings = ["".join(t.text or "" for t in si.iter(_M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]
    comments = {}
    for c in ET.fromstring(z.read("xl/comments1.xml")).iter(_M + "comment"):
        comments[c.get("ref")] = "".join(t.text or "" for t in c.iter(_M + "t")).strip()
    cells = {}
    for row in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).find(_M + "sheetData"):
        for c in row:
            v = c.find(_M + "v")
            val = None
            if v is not None:
                val = strings[int(v.text)] if c.get("t") == "s" else v.text
            cells[c.get("r")] = (val, xf_fill[int(c.get("s", 0))])
    return cells, comments


ledge, ledge_tips = {}, []
cells, cmts = read_ledge(LUIGI / "ledge/Hitting Ledge Hangs.xlsx")
for col, move in LEDGE_MOVES.items():
    if cmts.get(f"{col}2"):
        ledge_tips.append({"move": move, "text": " ".join(cmts[f"{col}2"].split())})
last = max(int(re.search(r"\d+", k).group(0)) for k in cells)
for rn in range(3, last + 1):
    label = (cells.get(f"B{rn}") or (None, None))[0]
    if not label:
        continue
    names, _ = resolve(label)
    entries = []
    for col, move in LEDGE_MOVES.items():
        diff = LEDGE_DIFF.get((cells.get(f"{col}{rn}") or (None, None))[1])
        if diff:
            note = " ".join(cmts.get(f"{col}{rn}", "").split())
            entries.append({"move": move, "diff": diff, "note": note} if note else {"move": move, "diff": diff})
    gen = " ".join(cmts.get(f"B{rn}", "").split())
    if re.match(r"copied over from", gen, re.I):
        gen = ""
    for n in names:
        if entries:
            ledge[n] = {"moves": entries, **({"note": gen} if gen else {})}

# shield poking (tier = cell fill color; extracted from the workbook by scripts/extract_shield_poke.py)
POKE_TIER = {"FF00B300": 1, "FFFFFF00": 2, "FFFFF225": 2, "FFFF9900": 3, "FFCC0000": 4, "FF666666": 0}  # 0 = can't poke
poke_src = json.loads((LUIGI / "shield-poke/shield-poke.json").read_text(encoding="utf-8"))
pc, pcm = poke_src["cells"], poke_src["comments"]


def pcell(ref):
    return pc.get(ref) or [None, None]


shield_poke = {}
last_poke = max(int(re.search(r"\d+", k).group(0)) for k in pc)
for rn in range(3, last_poke + 1):
    label = pcell(f"A{rn}")[0]
    if not label:
        continue
    names, variant = resolve(label)
    floor_text, floor_fill = pcell(f"F{rn}")
    entry = {}
    if floor_text:
        entry["floor"] = {"move": floor_text.strip(), "tier": POKE_TIER.get(floor_fill, 0)}
    parts = {}
    for col, key in (("B", "front"), ("C", "back"), ("D", "head")):
        t = POKE_TIER.get(pcell(f"{col}{rn}")[1])
        if t is not None:
            parts[key] = t
    if parts:
        entry["parts"] = parts
    alts = []
    cmt = pcm.get(f"F{rn}", "")
    for m in re.finditer(r"Tier\s*(\d)\s*:\s*(.*?)(?=Tier\s*\d\s*:|$)", cmt):
        txt = m.group(2).strip()
        if txt:
            alts.append({"tier": int(m.group(1)), "move": txt})
    if alts:
        entry["alts"] = alts
    notes = [pcell(f"{c}{rn}")[0].strip() for c in "GHIJK" if pcell(f"{c}{rn}")[0]]
    if notes:
        entry["notes"] = notes
    if not entry:
        continue
    if variant:
        entry["variant"] = variant
    for n in names:
        shield_poke.setdefault(n, []).append(entry)

# Bair > Dtilt followups: column B = Bair short hop, column C = full hop; cell comments hold damage and notes.
# (Extra columns D..M are unlabeled per-form variants for Shulk / Hero / Wii Fit and are not used.)
bz = zipfile.ZipFile(LUIGI / "bair-dtilt/Bair-Dtilt followups.xlsx")
b_strings = ["".join(t.text or "" for t in si.iter(_M + "t")) for si in ET.fromstring(bz.read("xl/sharedStrings.xml"))]
b_cells = {}
for row in ET.fromstring(bz.read("xl/worksheets/sheet1.xml")).find(_M + "sheetData"):
    for c in row:
        v = c.find(_M + "v")
        if v is not None:
            b_cells[c.get("r")] = b_strings[int(v.text)] if c.get("t") == "s" else v.text
b_comments = {c.get("ref"): " ".join("".join(t.text or "" for t in c.iter(_M + "t")).split())
              for c in ET.fromstring(bz.read("xl/comments1.xml")).iter(_M + "comment")}


def fmt_chain(s):
    s = re.sub(r"\bUpB\b", "up B", s.strip())
    s = re.sub(r"\bFf\b", "ff", s)
    return s.replace("-", " → ")


bair_dtilt = {}
for rn in range(2, 200):
    label = b_cells.get(f"A{rn}")
    if not label:
        continue
    entry = {}
    for col, key in (("B", "sh"), ("C", "fh")):
        chain = b_cells.get(f"{col}{rn}")
        if not chain or chain.upper() == "N/A":
            continue
        item = {"seq": fmt_chain(chain)}
        cmt = b_comments.get(f"{col}{rn}", "")
        m = re.match(r"(?i)does\s+([\d.]+)\s*%?\s*[,;]?\s*(.*)$", cmt)
        if m:
            item["dmg"] = m.group(1)
            cmt = m.group(2).strip()
        if cmt:
            item["note"] = re.sub(r"\b[A-Za-z]+(?:-[A-Za-z]+){2,}\b", lambda m: fmt_chain(m.group(0)), cmt)
        entry[key] = item
    if entry:
        for n in resolve(label)[0]:
            bair_dtilt[n] = entry

# matchup gameplans (hand-compacted from the Discord notes)
matchup = {}
mfile = json.loads((LUIGI / "gameplans/matchups.json").read_text(encoding="utf-8"))
for e in mfile["entries"]:
    for n in e["names"]:
        if n not in CANON.values():
            print("UNKNOWN character in matchups.json:", n)
        item = {"do": e["do"], "dont": e["dont"]}
        if e.get("stage"):
            item["stage"] = e["stage"]
        matchup[n] = item

out = {"roster": roster, "plan": plan, "moves": moves, "charSpecific": char_specific, "tumble": tumble,
       "crouch": crouch, "ledge": ledge, "ledgeTips": ledge_tips, "poke": shield_poke, "bairDtilt": bair_dtilt,
       "matchup": matchup}
OUT.write_text("window.LUIGI_DATA = " + json.dumps(out, ensure_ascii=True, separators=(",", ":")) + ";\n", encoding="utf-8")

# ---------------------------------------------------------------- report
names = [c["name"] for c in roster if not c["members"]]
print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
if unresolved:
    print("UNRESOLVED labels:", sorted(unresolved))
for label, src in (("Project L plan", plan), ("Dthrow>UpB", {n: 1 for n, m in moves.items() if "dthrowUpB" in m}),
                   ("Utilt>UpB", {n: 1 for n, m in moves.items() if "utiltUpB" in m}),
                   ("Nair>UpB", {n: 1 for n, m in moves.items() if "nairUpB" in m}),
                   ("Up B KO", {n: 1 for n, m in moves.items() if "upBKO" in m})):
    missing = [n for n in names if not src.get(n)]
    print(f"{label}: {len(names) - len(missing)}/{len(names)} chars; missing: {missing}")
