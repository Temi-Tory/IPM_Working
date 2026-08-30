# Diamond Patterns

A **diamond** is what the framework calls a reconvergence: a fork whose paths split, then meet again at a join, without the two paths being independent of each other — because they share the fork's own state. Treating them as independent (as a naive analysis would) overstates reliability; the framework instead finds every such pattern and conditions on it exactly.

## Conditioning sets

Every diamond carries a **conditioning set** — the smallest set of nodes that, once fixed to a definite state, makes the diamond's parents' signals independent of each other. The propagation resolves a diamond by enumerating every state of its conditioning set (2 to the power of the set's size, sub-problems), solving the diamond as a self-contained network under each one, and recombining. A conditioning set of size 1 costs 2 sub-problems; size 10 costs 1024 — this is genuinely the parameter that governs how expensive an exact analysis is, and it's what the Reliability tab's **conditioning width** statistic reports: the largest conditioning set the network actually forces.

## Maximal, unique, and nested diamonds

- A **maximal diamond** is the full reconvergence structure at one join — everything upstream that the join's paths share. Every diamond join carries exactly one.
- Diamonds can nest: reconvergence found *inside* a maximal diamond, once you condition on its outer fixed nodes, is a **sub-diamond** of it — a diamond within the diamond. A sub-diamond can have its own conditioning set, and that set can name a node the enclosing maximal diamond never fixes.
- A **unique diamond** is any distinct diamond the decomposition found, at any nesting level, stored once. The unique diamonds are exactly the maximal diamonds together with all of their sub-diamonds.
- A diamond with no sub-diamond of its own is **induced** — the smallest a diamond can be.

This distinction matters in practice: a network's full "which nodes did the algorithm ever have to fix" set is the union across **every** unique diamond, not just the maximal ones — a maximal-only view can miss nodes a nested sub-diamond fixes on its own.

## The Diamonds page

The standalone **Diamonds** page lists every scenario with reliability inputs and lets you identify their diamond structure independently of running a full belief computation — a lighter server call than a full propagation. If a scenario already has a full Reliability run recorded, its diamond structure shows immediately with no extra call.

The diamond list can be filtered by:

- **nesting** — all diamonds, induced diamonds only, or diamonds that have sub-diamonds of their own
- **conditioning-set size** — a minimum and/or maximum, to find the diamonds actually driving the network's cost

Opening a diamond shows its own local sources, conditioning set, size, and — if it has any — its sub-diamonds, which open the same way (a diamond is a network in its own right, at any nesting depth, so the detail view is the same view all the way down). From there you can run an analysis on the diamond in isolation, with its local sources overridable, or promote it into a new independent network.

## Where else diamonds show up

Reliability's own **Diamonds** tab shows the same structure scoped to one scenario, and its **Visualisation** tab highlights the full conditioning set on the network drawing. The **Cross-Scenario Profile** view can show a scenario's conditioning-set overlay on the network alongside another analysis's own result set, to see where they agree.
