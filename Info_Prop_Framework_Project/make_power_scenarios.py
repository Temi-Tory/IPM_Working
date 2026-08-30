#!/usr/bin/env python3
"""Build the power-network scenario folders for the interface chapter.

Usage:
    python make_power_scenarios.py power-network.EDGES --outdir dag_ntwrk_files/power-network
        [--reliable 1-2,3-10,5-13,7-8,11-19,14-21,16-18] [--seed 7]

Produces, under outdir:
    power-network.EDGES                     copy of the structure file
    Published_pf005/                        reliability only: the Tong and Tien 2019 case at pf = 0.05
    Published_pf001/ ... Published_pf020/   the other four published cases (0.01, 0.10, 0.15, 0.20)
    Baseline/                               all three toolkits, deterministic
    Degraded/                               all three toolkits, deterministic, one feeder derated
    Interval/                               reliability and schedule as intervals, flow deterministic
    Pbox/                                   reliability as parametric p-boxes

Reliability inputs follow Tong and Tien (2019), RESS 189:21-30, Section 4.2:
node priors 1.0; the seven listed links perfectly reliable (1.0); every other
link 1 - pf. These are published values. Flow capacities and schedule durations
are ASSIGNED for the demonstration and must be described as such in the thesis:
    capacities: links out of a source 100, listed equipment-free links unbounded,
                all other links 60; no node capacities.
                Degraded: every link into the terminal at 30.
    schedule:   an energisation sequence: source nodes 0, the terminal 0, every
                other node 1.5 (switching and checks); edges 0.
                Degraded: every node 2.5. Interval: [1.0, 2.0].
Edit the constants below if different assigned values are wanted, and record
what was used in Appendix A.

File shapes are the server's contracts (checked 30 August 2026):
    *-nodepriors.json         {"data_type": ..., "nodes": {id: value}}
    *-linkprobabilities.json  {"data_type": ..., "links": {"(u,v)": value}}
    *-capacities.json         {"data_type": "Float64", "edges": [{"source","destination","capacity"}]}
    *-cpm-inputs.json         {"data_type": ..., "time_analysis": {"node_durations", "edge_delays", "initial_time"}}
Interval values are {"lower": a, "upper": b}. P-box values follow the
per-value object form with "construction_type".
"""
import argparse
import json
import os
import shutil


def read_edges(path):
    edges = []
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line or not line[0].isdigit():
                continue
            u, v = line.split(",")[:2]
            edges.append((int(u), int(v)))
    return edges


def write(path, obj):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        json.dump(obj, fh, indent=2)


def reliability_files(outdir, scen, edges, nodes, reliable, link_value, prior_value=1.0,
                      data_type="Float64"):
    priors = {str(n): prior_value for n in nodes}
    links = {}
    for u, v in edges:
        key = f"({u},{v})"
        links[key] = 1.0 if (u, v) in reliable else link_value
    write(os.path.join(outdir, scen, f"{scen}-nodepriors.json"),
          {"data_type": data_type, "nodes": priors})
    write(os.path.join(outdir, scen, f"{scen}-linkprobabilities.json"),
          {"data_type": data_type, "links": links})


def capacity_file(outdir, scen, edges, sources, sinks, reliable, derate_into_sink=None):
    recs = []
    for u, v in edges:
        if u in sources:
            c = 100.0
        elif (u, v) in reliable:
            c = float("inf")
        else:
            c = 60.0
        if derate_into_sink is not None and v in sinks:
            c = derate_into_sink
        recs.append({"source": u, "destination": v,
                     "capacity": "Inf" if c == float("inf") else c})
    write(os.path.join(outdir, scen, f"{scen}-capacities.json"),
          {"data_type": "Float64", "edges": recs})


def cpm_file(outdir, scen, edges, nodes, sources, sinks, dur, interval=False):
    def val(x):
        return {"lower": x[0], "upper": x[1]} if interval else x
    nd = {}
    for n in nodes:
        if n in sources or n in sinks:
            nd[str(n)] = val((0.0, 0.0)) if interval else 0.0
        else:
            nd[str(n)] = val(dur)
    ed = {f"({u},{v})": (val((0.0, 0.0)) if interval else 0.0) for u, v in edges}
    write(os.path.join(outdir, scen, f"{scen}-cpm-inputs.json"),
          {"data_type": "Interval" if interval else "Float64",
           "time_analysis": {"node_durations": nd, "edge_delays": ed,
                             "initial_time": val((0.0, 0.0)) if interval else 0.0}})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("edges_file")
    ap.add_argument("--outdir", required=True)
    ap.add_argument("--reliable", default="1-2,3-10,5-13,7-8,11-19,14-21,16-18",
                    help="perfectly reliable links as u-v pairs in the corpus node numbering")
    args = ap.parse_args()

    edges = read_edges(args.edges_file)
    nodes = sorted(set([u for u, _ in edges] + [v for _, v in edges]))
    sources = {n for n in nodes if not any(v == n for _, v in edges)}
    sinks = {n for n in nodes if not any(u == n for u, _ in edges)}
    reliable = set()
    for tok in args.reliable.split(","):
        a, b = tok.split("-")
        a, b = int(a), int(b)
        if (a, b) in edges:
            reliable.add((a, b))
        elif (b, a) in edges:
            reliable.add((b, a))
        else:
            print(f"warning: reliable link {tok} not in edge list; check node numbering")

    os.makedirs(args.outdir, exist_ok=True)
    shutil.copy(args.edges_file, os.path.join(args.outdir, os.path.basename(args.edges_file)))
    print(f"{len(nodes)} nodes, {len(edges)} edges, sources {sorted(sources)}, sinks {sorted(sinks)}, "
          f"{len(reliable)} reliable links")

    # Published reproduction cases
    for pf, tag in [(0.01, "001"), (0.05, "005"), (0.10, "010"), (0.15, "015"), (0.20, "020")]:
        reliability_files(args.outdir, f"Published_pf{tag}", edges, nodes, reliable, 1.0 - pf)

    # Baseline: all three toolkits at pf = 0.05
    reliability_files(args.outdir, "Baseline", edges, nodes, reliable, 0.95)
    capacity_file(args.outdir, "Baseline", edges, sources, sinks, reliable)
    cpm_file(args.outdir, "Baseline", edges, nodes, sources, sinks, 1.5)

    # Degraded: pf = 0.20, links into the terminal derated, slower switching
    reliability_files(args.outdir, "Degraded", edges, nodes, reliable, 0.80)
    capacity_file(args.outdir, "Degraded", edges, sources, sinks, reliable, derate_into_sink=30.0)
    cpm_file(args.outdir, "Degraded", edges, nodes, sources, sinks, 2.5)

    # Interval: link probabilities [0.90, 0.97], durations [1.0, 2.0]
    # Reliability (nodepriors/linkprobabilities) interval values need an explicit "type":
    # "interval" tag -- InputProcessingModule.jl's deserialize_probability_value reads
    # data["type"] unconditionally before branching on it, so a bare {"lower","upper"} throws
    # KeyError: key "type" not found. (The CPM/schedule contract is different and genuinely
    # takes a bare {"lower","upper"} with no "type" -- confirmed against a live call; only the
    # reliability contract needs this wrapper. The module docstring above, written before this
    # was checked against a live call, doesn't distinguish the two -- corrected here.)
    priors = {str(n): {"type": "interval", "lower": 1.0, "upper": 1.0} for n in nodes}
    links = {f"({u},{v})": ({"type": "interval", "lower": 1.0, "upper": 1.0} if (u, v) in reliable
                            else {"type": "interval", "lower": 0.90, "upper": 0.97}) for u, v in edges}
    write(os.path.join(args.outdir, "Interval", "Interval-nodepriors.json"),
          {"data_type": "Interval", "nodes": priors})
    write(os.path.join(args.outdir, "Interval", "Interval-linkprobabilities.json"),
          {"data_type": "Interval", "links": links})
    capacity_file(args.outdir, "Interval", edges, sources, sinks, reliable)
    cpm_file(args.outdir, "Interval", edges, nodes, sources, sinks, (1.0, 2.0), interval=True)

    # Pbox: link probabilities as parametric p-boxes with interval mean
    priors = {str(n): {"type": "pbox", "construction_type": "scalar", "value": 1.0} for n in nodes}
    links = {}
    for u, v in edges:
        if (u, v) in reliable:
            links[f"({u},{v})"] = {"type": "pbox", "construction_type": "scalar", "value": 1.0}
        else:
            # Real contract (InputProcessingModule.jl create_parametric_interval_pbox):
            # "shape" (not "distribution"), "params" as a positional array (not "parameters"
            # dict), each interval-valued param wrapped as {"type":"interval","lower","upper"}.
            # The script's original {"distribution":..., "parameters": {"mean":...}} shape does
            # not match and would throw a KeyError on "shape" -- corrected before running.
            #
            # shape="normal" was tried first and rejected: a normal distribution has unbounded
            # tails, so its discretized p-box range (e.g. mean=[0.92,0.96], std=[0.01,0.02] ->
            # range [0.8582, 1.0218]) runs past 1.0 and is_valid_probability correctly refuses
            # it (a real validation catching a real modeling error, not a bug -- see FINDINGS.md
            # for the separate is_valid_probability(pbox) crash-vs-reject bug this surfaced).
            # shape="uniform" is naturally bounded by its own [a,b] params, so a probability
            # value with fuzzy-but-bounded edges never runs outside [0,1].
            links[f"({u},{v})"] = {"type": "pbox", "construction_type": "parametric_interval",
                                   "shape": "uniform",
                                   "params": [
                                       {"type": "interval", "lower": 0.88, "upper": 0.92},
                                       {"type": "interval", "lower": 0.95, "upper": 0.98},
                                   ]}
    write(os.path.join(args.outdir, "Pbox", "Pbox-nodepriors.json"),
          {"data_type": "pbox", "nodes": priors})
    write(os.path.join(args.outdir, "Pbox", "Pbox-linkprobabilities.json"),
          {"data_type": "pbox", "links": links})
    print("done; check the p-box value objects against InputProcessingModule.jl before use")


if __name__ == "__main__":
    main()
