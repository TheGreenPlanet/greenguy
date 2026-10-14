#!/usr/bin/env python3
"""Extract the "Shield Poke" tab (cell text, fill colors, comments) from the Google Sheets xlsx export into a small
JSON file. The xlsx itself is ~180 MB because of embedded GIFs, so it is not kept in the repo.

  curl -L -o shield.xlsx "https://docs.google.com/spreadsheets/d/<id>/export?format=xlsx"
  python3 -I scripts/extract_shield_poke.py shield.xlsx luigi/shield-poke/shield-poke.json
"""
import json, re, sys, zipfile
import xml.etree.ElementTree as ET

M = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
src, dst = sys.argv[1], sys.argv[2]
z = zipfile.ZipFile(src)

styles = ET.fromstring(z.read("xl/styles.xml"))
fills = []
for f in styles.find(M + "fills"):
    pf = f.find(M + "patternFill")
    fg = pf.find(M + "fgColor") if pf is not None else None
    fills.append(fg.get("rgb") if pf is not None and pf.get("patternType") == "solid" and fg is not None else None)
xf = [fills[int(x.get("fillId", 0))] for x in styles.find(M + "cellXfs")]
strings = ["".join(t.text or "" for t in si.iter(M + "t")) for si in ET.fromstring(z.read("xl/sharedStrings.xml"))]

names = re.findall(r'<sheet [^>]*name="([^"]+)"', z.read("xl/workbook.xml").decode())
assert names[0] == "Shield Poke", names

cells = {}
for row in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).find(M + "sheetData"):
    for c in row:
        v = c.find(M + "v")
        val = None
        if v is not None:
            val = strings[int(v.text)] if c.get("t") == "s" else v.text
        fill = xf[int(c.get("s", 0))]
        if val is not None or fill:
            cells[c.get("r")] = [val, fill]
comments = {c.get("ref"): " ".join("".join(t.text or "" for t in c.iter(M + "t")).split())
            for c in ET.fromstring(z.read("xl/comments1.xml")).iter(M + "comment")}
json.dump({"sheet": names[0], "cells": cells, "comments": comments}, open(dst, "w", encoding="utf-8"),
          ensure_ascii=False, indent=0)
print(f"{len(cells)} cells, {len(comments)} comments -> {dst}")
