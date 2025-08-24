# scaled_power_drone_network - Benchmark Results

## Algorithm Performance Summary

| Algorithm | Time | Memory | Accuracy |
|-----------|------|--------|----------|
| 33 Root Diamonds (layer 2) | 7.0 ± 1.0 ms | 4.2 MiB | Exact |
| 369 Unique Diamonds (layer 2) | 353.0 ± 35.0 ms | 328.7 MiB | Exact |
| Reachability (layer 3) | 11318.0 ms | 7249.9 MiB | Exact |
| Monte Carlo (N=10k) | 1.0 ± 0.0 ms | 419.4 MiB | Approximate |
| Monte Carlo (N=100k) | 4.0 ± 0.0 ms | 4189.7 MiB | Approximate |
| Monte Carlo (N=1M) | 47.0 ± 1.0 ms | 41900.6 MiB | Approximate |
