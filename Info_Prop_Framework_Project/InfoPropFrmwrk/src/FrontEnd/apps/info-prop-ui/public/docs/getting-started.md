# Getting Started

## Prerequisites

- **Julia 1.12** (the analysis server)
- **Node.js** and **npm** (the front end)
- A modern browser

## Starting the backend

From the framework's root folder (`InfoPropFrmwrk/`, the one holding `Project.toml`):

```bash
julia --project=. --threads=auto src/Server/start_server.jl
```

`--threads=auto` lets diamond identification and other parallel work use more than one core. The server listens on `http://127.0.0.1:8080` by default — set the `INFOPROP_HOST` environment variable to change the host.

## Starting the front end

In a separate terminal, from `InfoPropFrmwrk/src/FrontEnd`:

```bash
npx nx serve info-prop-ui
```

This starts the Angular development server and prints the local URL to open. The interface talks to the analysis server at `http://localhost:8080` — start the backend first, or the interface's server-status indicator on the Home page will show it as unreachable.

## Quick walkthrough

### 1. Upload a network

Open **Upload** and pick a folder (or individual files). The interface sorts what you give it by file name and folder structure — see [Preparing Your Data](/docs/data-formats) for the exact convention — into:

- one structure file (`<network>.EDGES`)
- one or more **scenarios**, each a named folder holding any subset of the four analysis-input types (node priors + link probabilities for Reliability, capacities for Flow, CPM inputs for Schedule)

A scenario folder's inputs are read straight from the files you gave — the interface invents no second format, and never guesses at a value it wasn't given.

### 2. Look at the network

Once uploaded, the **Network** page shows the structure the framework derived — every node's role (source, sink, fork, join), the topological layers, and connectivity counts — before you've run any analysis. This is frequently where a mistake in the input files announces itself.

### 3. Open a toolkit

The left-hand nav shows **Reliability**, **Diamonds**, **Flow**, **Schedule**, and **Profile**. A toolkit is enabled once its inputs exist somewhere on the network; hover a disabled one to see what it's waiting for. Each toolkit organises its own scenarios as cards you pick between, and most toolkits have a **Compare** tab for running several scenarios in one go and setting them side by side.

### 4. Compare across everything

Once you've run at least one scenario in any toolkit, **Cross-Scenario Profile** collects them: a roster of which scenarios have been tested under which toolkit, each toolkit's own metrics table, and a network drawing that can show — and compare — the result sets those analyses actually produced (bottleneck edges, conditioning sets, critical-path nodes, and so on).

## A minimal example

An 8-node grid with two sources (1, 2) and one sink (8):

**`grid-graph.EDGES`** (`source,destination` — a header row followed by one edge per line):

```
source,destination
1,3
1,4
2,4
2,5
3,6
4,6
4,7
5,7
6,8
7,8
```

**`float/grid-graph-nodepriors.json`**:

```json
{
  "data_type": "Float64",
  "nodes": { "1": 0.9, "2": 0.85, "3": 0.95, "4": 0.9, "5": 0.88, "6": 0.92, "7": 0.91, "8": 0.93 }
}
```

**`float/grid-graph-linkprobabilities.json`**:

```json
{
  "data_type": "Float64",
  "links": {
    "(1,3)": 0.8, "(1,4)": 0.75, "(2,4)": 0.82, "(2,5)": 0.79,
    "(3,6)": 0.85, "(4,6)": 0.77, "(4,7)": 0.81, "(5,7)": 0.83,
    "(6,8)": 0.88, "(7,8)": 0.86
  }
}
```

Upload the folder containing `grid-graph.EDGES` and the `float/` subfolder, and Reliability unlocks with one scenario, "float", ready to run.

## Troubleshooting

| Issue | Check |
|---|---|
| Home page shows the server as unreachable | Is `start_server.jl` actually running? Is anything else already bound to port 8080? |
| No toolkits unlock after upload | File names must match the convention (`*-nodepriors.json`, `*-linkprobabilities.json`, `*-capacities.json`, `*-cpm-inputs.json`) — see [Preparing Your Data](/docs/data-formats) |
| "No .EDGES file found" | The `.EDGES` file must sit at the root of the uploaded folder, not inside a scenario subfolder |
| Diamond identification is slow on a large network | Start Julia with more threads: `julia --project=. --threads=8 src/Server/start_server.jl` |
