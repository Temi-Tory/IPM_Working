# Citation status — final audit (2026-09-06)

Source: `validation/probability/notes/LITERATURE_VERIFICATION.md` (2026-08-10 pass, 6/7 checked)
plus two citations closed today via web search. This supersedes the "still open" line at the
bottom of that file for items 7 and the DBLP check on item 5.

## Already confirmed and already IN the current manuscript draft (`newress.zip` main.tex)
No action needed — verified present in the reference list:
- Williamson & Downs (1990), *Int. J. Approximate Reasoning* 4(2), 89–158.
- Ferson, Kreinovich, Ginzburg, Myers, Sentz (2003), Sandia SAND2002-4015.
- Lauritzen & Spiegelhalter (1988), *J. Royal Statistical Society B* 50(2), 157–224.
- Jones et al. (2025) drone source study — present, but still flagged `[submitted]` with an
  author note to update publication status at proof stage (check before final submission).
- Pearl (1988), Tong & Tien (2019) — present.

## Confirmed real, verified in detail, but NOT YET in the manuscript draft — recommend adding
These were fully verified (abstracts/full text read) in `LITERATURE_VERIFICATION.md` but the
integration into `§1.1 Related Works` / `§4.3` / the R3.8 broader-applicability response never
happened. Recommend folding in during the rewrite pass — they materially strengthen exactly the
places reviewers pushed hardest (R3.1 novelty vs. cutset/junction-tree, R3.8 broader
applicability, and the "can BDD do interval" claim in §5.3.1):

1. **Fagiuoli & Zaffalon (1998)**, "2U: An exact interval propagation algorithm for polytrees
   with binary variables," *Artificial Intelligence* 106(1), 77–107, and **Mauá & Cozman (2020)**,
   "Thirty years of credal networks," *Int. J. Approximate Reasoning* 126, 133–157 (read in full,
   §§1,3,5.3,6.1,6.2,7). **Use for R3.8 (broader applicability to Bayesian/credal networks)**:
   Mauá & Cozman's own complexity results show bounded treewidth does NOT rescue tractability once
   point probabilities become credal sets (still NP-hard; only an approximation scheme exists, and
   only with a second restriction). This makes IPA's width-governed *exact* imprecise result a
   genuinely non-trivial claim, not a free consequence of bounded width — a precise, defensible
   answer to reviewer #3's "we need to be VERY VERY certain" concern (see `JUDGMENT_CALLS.md`).
2. **Feng, Patelli, Beer, Coolen (2016)**, RESS 150, 116–125, and **Behrensdorf, Broggi, Beer
   (2019)**, ASCE-ASME J. Risk Uncertainty Eng. Syst. B. Together give the correct three-way
   related-work structure for the imprecise-reliability differentiation paragraph: Feng et al. =
   analytic bound propagation given a survival signature (requires type-exchangeable components;
   signature computation itself is separate/hard for general topologies); Behrensdorf et al. =
   the genuine simulation-based comparator (Monte Carlo + vine copulas + survival signature). Do
   NOT cite Feng et al. as "needs simulation" — verified that claim is false for that paper
   specifically.
3. **Jacob, Dubois & Cardoso (2011)**, "Uncertainty Handling in Quantitative BDD-Based Fault-Tree
   Analysis by Interval Computation," SUM 2011 (5th Int. Conf. on Scalable Uncertainty Management,
   Dayton OH), LNCS vol. 6929, pp. 205–218, Springer. **Venue confirmed today** (was previously
   "worth a DBLP check" — done: DOI 10.1007/978-3-642-23963-2_17, SUM 2011 confirmed correct).
   And **Imakhlaf, Hou & Sallak (2017)**, IFAC PapersOnLine 50(1), 12243–12248 (extends to
   non-coherent systems via belief functions). **Use to sharpen §5.3.1/related-work**: BDD-based
   interval reliability already exists and, like IPA, exploits monotonicity — but its own
   literature self-reports it doesn't scale (monotonicity-checking cost) and produces
   ordering-dependent results needing a multi-ordering conservative envelope. Do not claim "BDD
   cannot do interval at all" — the precise, citable claim is narrower and still favourable to IPA.
4. **Utkin & Coolen (2007)**, "Imprecise Reliability: An Introductory Overview," in
   *Computational Intelligence in Reliability Engineering* SCI vol. 40, pp. 261–306. General
   background/motivation citation for the introduction only (not a technical comparator).

## Resolved today (previously open items)

5. **Jacob et al. (2011) exact venue** — CLOSED. Confirmed via web search: SUM 2011 proceedings,
   Springer LNCS 6929, DOI `10.1007/978-3-642-23963-2_17`. No longer "worth a DBLP check" —
   checked.
6. **"Kozine, Krymsky & Gurov"** — the three-author combination as named does not appear to
   exist as a single paper. Found and read the title page + abstract of the closest real match:
   **Kozine, I. & Krymsky, V. (2017)**, "Computing interval-valued reliability measures:
   application of optimal control methods," *International Journal of General Systems* 46(2),
   144–157, DOI `10.1080/03081079.2017.1294167` (open PDF via DTU Orbit). **Two authors only —
   no "Gurov" on this paper.** Its scope is single-component interval-reliability derivation from
   partial statistical information via Pontryagin's maximum principle — not network/DAG reliability,
   so it is at most a background citation (similar role to Utkin & Coolen 2007), not a technical
   comparator to IPA. Separately, web search surfaced **Utkin & Gurov**, "New reliability models
   based on imprecise probabilities" (title only, not yet read) as a plausible source of the
   "Gurov" name — i.e. the original three-name citation likely conflates two different two-author
   papers. **Recommendation: use Kozine & Krymsky (2017) if a general imprecise-reliability
   background citation is wanted here; do not cite a nonexistent "Kozine, Krymsky & Gurov" paper.**
   If the user specifically meant the Utkin & Gurov paper, it has not yet been independently
   verified/read — flag for a follow-up check before citing.

## Still genuinely needs the user

- Confirm whether Jones et al. (2025) has moved from "submitted" to an accepted/published state
  before the final submission (affects the reference-list entry and in-text tense).
- The **original submitted RESS manuscript (.tex/PDF)** and **official journal decision letter**
  are not in the repo — user said they will supply these separately (see plan). No literature
  action is blocked on this, but the cover letter / response tracker should be re-checked against
  them once available.
- If the user wants the Utkin & Gurov paper independently verified (rather than dropped), supply
  a PDF or exact title/venue and it can be checked the same way as above.
