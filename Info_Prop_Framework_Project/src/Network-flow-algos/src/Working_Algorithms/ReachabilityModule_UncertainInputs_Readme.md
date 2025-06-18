# =================================
# UNCERTAINTY REPRESENTATION HIERARCHY FOR BELIEF NETWORKS
# =================================

# =================================
# 1. THREE-TIER COMPUTATIONAL APPROACH
# =================================

# TIER 1: FIXED (Float64) - Deterministic Analysis
# - Single point estimates
# - Maximum computational speed
# - Validation and baseline analysis
# - Large-scale municipal networks (10k+ nodes)

# TIER 2: INTERVALS - Bounded Uncertainty  
# - Conservative bounds: [lower, upper]
# - Tractable for large networks
# - Preserves essential uncertainty information
# - Automatic fallback from p-boxes when needed

# TIER 3: P-BOXES - Full Distributional Uncertainty
# - Complete distribution families (normal, beta, uniform, etc.)
# - Dependency modeling capabilities  
# - Maximum precision for uncertainty quantification
# - Smaller networks or critical subsystems

# =================================
# 2. COMPUTATIONAL SCALING
# =================================

# For belief propagation with:
# - N nodes, E edges, D diamonds, C conditioning nodes per diamond

#                    FIXED       INTERVALS    P-BOX(n=200)
# Basic operation:   O(1)        O(1)         O(n²) = 40,000
# Per edge:          O(1)        O(1)         O(40,000)  
# Per node:          O(degree)   O(degree)    O(40,000×degree)
# Diamond conditioning: O(2^C)   O(2^C)       O(40,000×2^C)
# Inclusion-exclusion: O(2^K)    O(2^K)       O(40,000×2^K)

# Municipal network scaling (N≈10,000, E≈50,000):
# - Fixed: ~10^5 operations (FAST)
# - Intervals: ~10^5 operations (FAST) 
# - P-box: ~10^9 operations (SLOW but manageable for smaller networks)

# =================================
# 3. WHAT EACH TIER CAN REPRESENT
# =================================

# FIXED VALUES CAN REPRESENT:
# - Deterministic scenarios: "Exactly 0.7 probability"
# - Point estimates: "Best guess is 0.6"  
# - Validation cases: "Known ground truth"
# - Baseline analysis: "What if everything was certain?"

# INTERVALS CAN REPRESENT:
# - Bounded uncertainty: "Between 30% and 70%"
# - Measurement error: "0.6 ± 0.1" → [0.5, 0.7]
# - Conservative bounds: "At least 0.2, at most 0.9"
# - Epistemic uncertainty: "Don't know exactly, but bounded"
# - Ranges from expert judgment: "Somewhere between..."

# INTERVALS CANNOT REPRESENT:
# - Distribution shapes: Normal vs beta vs uniform
# - Multimodal distributions: Two peaks at 0.2 and 0.8
# - Dependency structures: "If A is high, B tends to be low"
# - Probability masses: "90% chance it's exactly 0.5"

# P-BOXES CAN REPRESENT:
# - Full distribution families: normal(μ=[0.4,0.6], σ=[0.1,0.2])
# - Uncertain parameters: beta(α∈[2,3], β∈[1,2])
# - Complex dependencies: Copula structures
# - Everything intervals can, plus distributional shape

# =================================
# 4. CONVERSION CAPABILITIES
# =================================

# UPWARD CONVERSION (Less → More Information):
# Fixed → Interval: point_value → [point_value, point_value]
# Fixed → P-box: point_value → dirac_delta(point_value)
# Interval → P-box: [a,b] → uniform(a,b) or makepbox(interval(a,b))

# DOWNWARD CONVERSION (More → Less Information):  
# P-box → Interval: pbox.range → [pbox.range.lo, pbox.range.hi]
# P-box → Fixed: pbox.mean_estimate → single_point_estimate
# Interval → Fixed: interval.midpoint → (lower + upper)/2

# AUTOMATIC FALLBACK STRATEGY:
# Try P-box → If intractable → Convert to Interval → If still slow → Use Fixed

# =================================
# 5. DECISION FRAMEWORK: WHEN TO USE WHAT
# =================================

# USE FIXED WHEN:
# ✓ Network size > 5,000 nodes
# ✓ Validation against known results
# ✓ Baseline/deterministic scenario analysis
# ✓ Quick screening of network behavior
# ✓ Real-time analysis requirements

# USE INTERVALS WHEN:
# ✓ Network size: 1,000-10,000 nodes  
# ✓ Uncertainty bounds are most important information
# ✓ Conservative estimates acceptable
# ✓ Measurement/epistemic uncertainty dominates
# ✓ P-box analysis becomes intractable
# ✓ Need "good enough" answers quickly

# USE P-BOXES WHEN:
# ✓ Network size < 1,000 nodes
# ✓ Distribution shapes matter for decisions
# ✓ Complex uncertainty characterization needed
# ✓ Research/detailed analysis phase
# ✓ Small critical subsystems require precision
# ✓ Have computational time for thorough analysis

# =================================
# 6. PRACTICAL IMPLEMENTATION STRATEGY
# =================================

# TIERED ANALYSIS WORKFLOW:

# PHASE 1: RAPID SCREENING (Fixed)
# - Identify critical paths and bottlenecks
# - Validate algorithm correctness
# - Establish baseline performance metrics

# PHASE 2: UNCERTAINTY BOUNDING (Intervals)  
# - Propagate realistic uncertainty bounds
# - Identify nodes with high uncertainty
# - Conservative risk assessment

# PHASE 3: DETAILED ANALYSIS (P-boxes)
# - Focus on critical subsystems identified in Phases 1-2
# - Full distributional analysis for key decision nodes
# - Sensitivity analysis with distribution families

# ADAPTIVE NETWORK DECOMPOSITION:
# - Bulk network: Intervals
# - Critical paths: P-boxes  
# - Non-critical branches: Fixed values

# =================================
# 7. UNCERTAINTY SOURCES AND BEST REPRESENTATIONS
# =================================

# MEASUREMENT UNCERTAINTY: "Sensor ± error"
# → Intervals: [measurement - error, measurement + error]

# EXPERT JUDGMENT: "Around 60%, maybe 40-80%"
# → Intervals: [0.4, 0.8] (conservative)
# → P-boxes: beta or triangular distribution (if shape info available)

# MODEL PARAMETER UNCERTAINTY: "Could be normal(0.6, σ∈[0.1,0.2])"
# → P-boxes: normal(0.6, interval(0.1, 0.2))
# → Intervals: Extract range bounds when p-box intractable

# EPISTEMIC UNCERTAINTY: "Don't know true model"
# → Intervals: Conservative bounds usually sufficient

# ALEATORIC UNCERTAINTY: "Inherent process randomness"
# → P-boxes: Need distribution shape for proper modeling
# → Intervals: When only bounds matter for decisions

# =================================
# 8. PERFORMANCE BENCHMARKS
# =================================

# TYPICAL MUNICIPAL NETWORK (10,000 nodes):
# - Fixed: ~1 second
# - Intervals: ~5 seconds  
# - P-boxes: ~20 minutes (if feasible)

# MEDIUM NETWORK (1,000 nodes):
# - Fixed: ~0.1 seconds
# - Intervals: ~0.5 seconds
# - P-boxes: ~30 seconds

# SMALL NETWORK (100 nodes):
# - Fixed: ~0.01 seconds  
# - Intervals: ~0.05 seconds
# - P-boxes: ~1 second

# MEMORY SCALING:
# - Fixed: 8 bytes per belief value
# - Intervals: 16 bytes per belief value
# - P-boxes: ~1.6KB per belief value (200 discretization points)

# =================================
# 9. VALIDATION STRATEGY
# =================================

# CORRECTNESS VALIDATION:
# 1. Deterministic cases: Interval and P-box should reduce to Fixed
# 2. Monotonicity: More uncertainty in → more uncertainty out
# 3. Containment: Fixed result should lie within Interval bounds
# 4. P-box range should match or contain Interval bounds

# PERFORMANCE VALIDATION:  
# 1. Start small: Validate all three tiers on <100 node networks
# 2. Scale up: Test Intervals on medium networks (1k nodes)
# 3. Stress test: Push Fixed implementation to large networks (10k+ nodes)

# UNCERTAINTY VALIDATION:
# 1. Known distributions: P-box → Interval conversion should be conservative
# 2. Expert elicitation: Do Interval bounds capture expert uncertainty?
# 3. Sensitivity analysis: How much do results change with different uncertainty levels?