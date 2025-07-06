# API Format Update: Edge List + JSON

The server framework has been updated to accept edge list format instead of CSV adjacency matrices for better HTTP request efficiency.

## New Request Format

### POST /api/processinput

**Old Format (CSV):**
```json
{
  "csvContent": "0,1,0\n1,0,1\n0,1,0"
}
```

**New Format (Edge List + JSON):**
```json
{
  "edges": [
    {"source": 1, "destination": 2},
    {"source": 2, "destination": 3}
  ],
  "nodePriors": {
    "data_type": "Float64",
    "nodes": {
      "1": 0.9,
      "2": 0.8,
      "3": 0.7
    }
  },
  "edgeProbabilities": {
    "data_type": "Float64", 
    "links": {
      "(1,2)": 0.95,
      "(2,3)": 0.85
    }
  }
}
```

## Benefits

1. **More Efficient**: Edge list format is more compact than adjacency matrices for sparse networks
2. **Better for HTTP**: JSON arrays are easier to handle than large CSV strings
3. **Type Support**: Supports Float64, Interval, and pbox data types for probabilities
4. **Cleaner Separation**: Graph structure (edges) separate from probabilities (JSON)

## Supported Data Types

- **Float64**: Simple numeric values (0.0 to 1.0)
- **Interval**: `{"type": "interval", "lower": 0.1, "upper": 0.9}`
- **pbox**: Complex probability box structures

## Validation

The server validates:
- Edge list format (source/destination integers)
- No self-loops
- Positive node IDs
- JSON structure for probabilities
- Probability values in valid ranges (0-1 for Float64)

## Backward Compatibility

The legacy CSV format is still supported through a compatibility function, but the new edge list format is recommended for all new implementations.