# In-game rage tests

Each row is something measured in game for the `dair > nair > dair > ff > up B` route (fresh moves, opponent
percent as listed). `scripts/build_data.py` fits the rage model to these rows.

| kind | meaning | own_pct | opponent_pct |
|---|---|---|---|
| `last_rage_at_zero` | highest own % at which the route still works on a 0% opponent | (blank) | the own % you found |
| `lowest_opponent_pct` | lowest opponent % at which the route works while Luigi is at `own_pct` | Luigi's % | the opponent % you found |
| `highest_opponent_pct` | highest opponent % at which the route works while Luigi is at `own_pct` | Luigi's % | the opponent % you found |

`stage` is where the test was done (leave blank if unknown). The offsets are fitted on all rows together, so
mixing stages blurs the fit: prefer one stage per batch of tests and note it here.

Add a row, run `python3 -I scripts/build_data.py`, and the model refits.
