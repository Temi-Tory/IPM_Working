# Preparing Your Data

The interface invents no second file format: the bytes you upload are the bytes the framework reads. Everything below is the real, current contract, not an approximation of it.

## Folder layout

```
<network-name>/
  <network-name>.EDGES
  <scenario>/
    *-nodepriors.json         *-linkprobabilities.json   (Reliability)
    *-capacities.json                                    (Flow)
    *-cpm-inputs.json                                     (Schedule)
```

A scenario folder can carry **any subset** of the four input types — a network folder holding several scenario folders supports the whole comparative workflow from one upload. There are two conventions for naming a scenario folder, both handled automatically:

- **Value-form folders** — the folder is named `float` / `interval` / `pbox`, one value form per folder.
- **Operating-case folders** — an arbitrary name (`Degraded`, `Edge Bottleneck Demo`, `01 Source Limited`, ...), often carrying every input type at once. The value form then comes from each file's own top-level `data_type` field, not the folder name.

## Structure — `<network>.EDGES`

A header row, then one edge per line:

```
source,destination
1,3
1,4
2,4
```

Must sit at the root of the uploaded folder, not inside a scenario subfolder.

## Reliability — node priors and link probabilities

**`*-nodepriors.json`**:

```json
{
  "nodes": { "1": 0.9, "2": 0.85 },
  "data_type": "Float64",
  "serialization": "compact",
  "description": "..."
}
```

**`*-linkprobabilities.json`** — link keys are the edge as a string, `"(u,v)"`:

```json
{
  "links": { "(1,2)": 0.8, "(1,3)": 0.75 },
  "data_type": "Float64",
  "serialization": "compact",
  "description": "..."
}
```

`data_type` is `"Float64"` for a deterministic value, `"Interval"` for an interval — each `nodes`/`links` value then becomes `{ "type": "interval", "lower": ..., "upper": ... }` — or a p-box `data_type` string (containing `"pbox"`) for a probability-box value, with a fuller per-value object (shape, bounds, discretisation). Both files must be present, and complete, for the scenario to unlock Reliability.

## Flow — capacities

Float64 only — the server hard-rejects any other `data_type`:

```json
{
  "data_type": "Float64",
  "edges": [
    { "source": 1, "destination": 2, "capacity": 10 },
    { "source": 1, "destination": 3, "capacity": 5 }
  ],
  "nodes": [{ "node": 2, "capacity": 8 }],
  "description": "..."
}
```

`nodes` (per-node capacity limits) is optional.

## Schedule — CPM inputs

```json
{
  "data_type": "Float64",
  "time_analysis": {
    "node_durations": { "1": 0, "2": 8 },
    "edge_delays": { "(1,2)": 0 },
    "initial_time": 0
  },
  "cost_analysis": {
    "node_costs": { "1": 0, "2": 120 },
    "edge_costs": { "(1,2)": 0 },
    "initial_cost": 0
  }
}
```

`time_analysis` is **required** — a CPM file without it is rejected outright. `cost_analysis` is **optional**; the Cost tab only appears when it's present. Both sections' value maps follow the same `data_type` rule as Reliability's: `"Float64"` gives plain numbers, `"Interval"` gives `{ "lower": ..., "upper": ... }` objects (a `"type": "interval"` key is accepted alongside them but not required — the parser reads `lower`/`upper` directly).

## A scenario folder is not required to be complete

An incomplete scenario (say, a `nodepriors.json` with no matching `linkprobabilities.json`) simply doesn't unlock Reliability for that scenario — it doesn't block the upload or the other toolkits. The **Add inputs manually** editor (reachable from any toolkit's empty state) can fill in exactly what's missing, in the browser, without hand-authoring JSON.

## Filling in the values you don't have yet

If you have a network's structure and want to explore what the analyses show without every input file in hand, the missing-inputs editor lets you enter values directly — a bulk value across every node/edge, or per-item overrides — and it writes files in exactly the shapes above.
