# greenguy.gg — Luigi lookup (Smash Ultimate)

Type a character and a stage, get Luigi's zero-to-death (ZTD) window and the other kill confirms.
Layout is modelled on [monke.gg](https://monke.gg) (a copy of that site is kept in `reference/monke.gg/`).

## Run
```
python3 -m http.server -d site 8000   # then open http://localhost:8000
```
(`site/index.html` also works opened directly from disk.)

## Data
* `luigi/**.csv` — lab data from the Luigi Discord.
* `luigi/ztd/project-l/*.csv` — Project L by Venus (one tab per character), saved with
  `https://docs.google.com/spreadsheets/d/1nhceHRGe8r8JRKCWfIGO7Q5GegXKqs32spkgaSofCa8/gviz/tq?tqx=out:csv&sheet=<tab name>`.
  This drives the ZTD box.
* `luigi/ztd/ztd-*.csv` — the older 0-death sheet (overlapping windows). Only its character-specific combos tab is still used.
* `python3 -I scripts/build_data.py` regenerates `site/data.js` from those CSVs and prints which characters have no data.
