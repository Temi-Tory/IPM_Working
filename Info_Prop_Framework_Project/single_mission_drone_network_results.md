# single-mission-drone-network - Benchmark Results

## Algorithm Performance Summary

| Algorithm | Time | Memory | Accuracy |
|-----------|------|--------|----------|
| Root Diamonds (layer 1) | 8.0 ± 2.0 ms | 4.2 MiB | Exact |
| Unique Diamonds (layer 2) | 361.0 ± 20.0 ms | 328.7 MiB | Exact |
| Reachability (layer 3) | 13802.0 ms | 7249.9 MiB | Exact |
| Exact Computation | 230.0 ± 15.0 ms | 188.6 MiB | Exact |
| Monte Carlo (N=10k) | 1.0 ± 0.0 ms | 419.8 MiB | Approximate |
| Monte Carlo (N=100k) | 5.0 ± 0.0 ms | 4190.7 MiB | Approximate |
| Monte Carlo (N=1M) | 47.0 ± 0.0 ms | 41900.1 MiB | Approximate |

## Exact Computation Sinkonly Result
node_id|ipa_result|exact_so|abs_error_exact_so|mc_10k|abs_error_10k|mc_100k|abs_error_100k|mc_1m|abs_error_1m
115|0.32090460184223896|N/A|N/A|0.3196|0.0013046018422389616|0.31985|0.0010546018422389336|0.321103|0.0001983981577610705
