# =============================================================================
# UNCERTAINTY REPRESENTATION COMPARISON
# =============================================================================

# =============================================================================
# 1. WHAT INTERVALS CAN AND CANNOT REPRESENT
# =============================================================================

# INTERVALS CAN REPRESENT:
# - Uniform distributions: U[0.3, 0.7]
# - "Don't know exactly, but bounded": P ∈ [0.4, 0.8]
# - Worst-case bounds: "At least 0.2, at most 0.9"
# - Measurement uncertainty: "0.6 ± 0.1" → [0.5, 0.7]

# INTERVALS CANNOT REPRESENT:
# - Multimodal: P = 0.2 with 50% chance, 0.8 with 50% chance
# - Skewed: Beta(2,5) distribution 
# - Probability mass: P = 0.5 exactly with 90% confidence
# - Complex shapes: Bimodal, triangular, etc.
# - Dependencies: "If A is high, then B is low"

# Example of what's lost:
# True distribution: Beta(2,5) has mean≈0.29, most mass in [0.1, 0.5]
# Interval representation: [0.0, 1.0] (loses all shape information!)

# =============================================================================
# 2. SLICES: THE MIDDLE GROUND
# =============================================================================

# Slices = Discretized probability distributions
struct ProbSlices
    values::Vector{Float64}    # [0.1, 0.3, 0.5, 0.7, 0.9]
    weights::Vector{Float64}   # [0.1, 0.2, 0.4, 0.2, 0.1] (probabilities)
end

# SLICES CAN REPRESENT:
# - Arbitrary distribution shapes
# - Multimodal distributions
# - Skewed distributions  
# - Discrete probability masses
# - Much more than intervals, less than full p-boxes

# SLICES ADVANTAGES:
# - More expressive than intervals
# - Faster than full p-boxes (fewer discretization points)
# - Can tune granularity (5 slices vs 200 p-box steps)
# - Operations still tractable: O(n²) but n is small

# Example operations with 5 slices:
# Multiplication: 5×5 = 25 operations
# vs P-box: 200×200 = 40,000 operations!

# =============================================================================
# 3. COMPUTATIONAL SCALING ANALYSIS
# =============================================================================

# For a network with:
# - N nodes
# - E edges  
# - D diamond structures
# - C conditioning nodes per diamond

#                    INTERVALS    SLICES(n=5)    P-BOX(n=200)
# Basic operation:   O(1)         O(n²) = 25     O(n²) = 40,000
# Per edge:          O(1)         O(25)          O(40,000)
# Per node:          O(degree)    O(25×degree)   O(40,000×degree)
# Diamond conditioning: O(2^C)    O(25×2^C)      O(40,000×2^C)

# For municipal network: N≈10,000, E≈50,000, typical diamonds with C=3-5:
# - Intervals: ~10^5 operations
# - Slices: ~10^7 operations  
# - P-box: ~10^9 operations (INTRACTABLE!)

# =============================================================================
# 4. WHEN TO USE WHAT
# =============================================================================

# USE INTERVALS WHEN:
# - Speed is critical (large networks)
# - Conservative bounds acceptable
# - Uncertainty sources are genuinely "bounded but unknown"
# - You need "fast and reasonable" over "precise"

# USE SLICES WHEN:
# - Need shape information (multimodal, skewed)
# - Medium-sized networks (hundreds to thousands of nodes)
# - Want balance of speed and accuracy
# - Can tune granularity based on needs

# USE P-BOXES WHEN:
# - Small networks (< 100 nodes)
# - Maximum precision required
# - Complex dependency modeling needed
# - Research/analysis where computational time isn't critical

# =============================================================================
# 5. PRACTICAL RECOMMENDATION FOR LARGE NETWORKS
# =============================================================================

# HYBRID APPROACH:
# 1. Start with intervals for initial screening
# 2. Use slices for detailed analysis of critical subnetworks
# 3. Reserve p-boxes for small, high-stakes components

# ADAPTIVE GRANULARITY:
# - Core network: Intervals (speed)
# - Critical paths: 3-5 slices
# - Key decision nodes: 10-20 slices
# - Special analysis: Full p-boxes

# =============================================================================
# 6. UNCERTAINTY TYPES AND BEST REPRESENTATIONS
# =============================================================================

# MEASUREMENT UNCERTAINTY: "Sensor reading ± error"
# → Intervals work well: [measurement - error, measurement + error]

# EXPERT JUDGMENT: "Probably around 0.6, could be 0.4-0.8"
# → Slices work better: Can represent central tendency + bounds

# MODEL UNCERTAINTY: "Parameter could follow Beta(2,3) distribution"
# → P-boxes needed: Full distribution shape matters, but can extract intervals from it
# → Slices can also work if discretized well

# EPISTEMIC UNCERTAINTY: "Don't know the true model"
# → Intervals often sufficient: Conservative bounds

# ALEATORIC UNCERTAINTY: "Inherent randomness in process"
# → Slices/P-boxes: Need to capture distribution shape
