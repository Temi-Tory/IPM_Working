# Grid cost profiling — IPA vs PBA (empirical complexity confirmation)

Grid config A (nodes 1.0 / links 0.9). DEFINITE structural: n_diamonds=12, maxcond=4, measured_ops=57, Work=sum 2^|C_d|*|E_d|=880.


## Interval
- TIME  (236 samples): PBA 0.0% | IPA 97.9% | other(Base/GC) 2.1%
- ALLOC (sampled)   : PBA 0.0% | IPA 100.0% | other 0.0%

_p-box cost is ~entirely PBA discretised convolution; IPA's own imprecise overhead is the Interval
figure (~1.5x Float64). 'other'=Base/GC. Confirms runtime is dominated by the p-box arithmetic backend,
not the diamond algorithm._
