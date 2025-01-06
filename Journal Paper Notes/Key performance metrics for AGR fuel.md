# System Performance Framework for Nuclear Decommissioning

## I. Core Process Metrics

### A. Resource Utilization
- Cave occupancy rate
- PT allocation efficiency 
- FGRR availability
- Staff coverage

### B. Quality & Performance
- Drying success probability (0.8-0.95)
- Water removal verification
- Vacuum effectiveness
- Gas sampling integrity

### C. Time Management
- Total cycle duration (96-144h)
- Critical path delays
- Equipment idle time
- Staff shift utilization

## II. Operational Constraints

### A. Time Constraints
- Operating hours: M-F 09:00-16:00
- Break period: 12:00-13:00
- Shift handovers
- Weekend downtime

### B. Process Times
- Drying cycle: 24h (can run off-shift)
- Gas sampling: 20 sample bottles, 2 ports
- Storage periods: 24-72h monitoring
- Transfer times: 1h between operations

### C. Resource Limits
- 2 pressure transducers total
- EADR cave: Max 2 vessels
- FGRR cave: 1 vessel at a time
- 2 gas sampling operations per day

## III. DAG Structure Implementation

### A. Node Properties
- Processing state: wet/dry
- Failure probability (based on pin condition)
- Resource requirements (PT, staff, cave space)
- Processing time windows
- Temperature/pressure measurements

### B. Edge Properties
- Transfer times between caves
- Resource dependencies
- Process sequencing constraints
- Monitoring requirements

## IV. IPM Integration Layers

### A. Resource Management Layer
The physical constraints and availability metrics propagation system, including:
- Resource state tracking
- Equipment allocation
- Staff availability management

### B. Process Quality Layer
Technical performance monitoring system:
- Drying effectiveness tracking
- Gas sampling results
- System integrity monitoring

### C. Temporal Coordination Layer
Timing constraints management:
- Schedule coordination
- Shift pattern alignment
- Sequential/parallel processing management

## V. Message Passing Implementation

### A. State Updates
- Node status exchange (wet/dry, occupied/available)
- Resource allocation coordination
- Staff availability signaling

### B. Performance Metrics
- Quality measurement propagation
- Success probability updates
- System-wide metric aggregation

### C. Time Management
- Schedule constraint propagation
- Process duration coordination
- Shift pattern integration
