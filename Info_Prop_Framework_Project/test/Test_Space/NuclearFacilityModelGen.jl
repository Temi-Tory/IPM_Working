module NuclearFacilityModel

using Graphs

#====
Constants
====#
# Facility constants
const MAX_VESSELS_EADR = 2
const MAX_VESSELS_FGRR = 1
const NUM_PRESSURE_TRANSDUCERS = 2
const MAX_SAMPLE_BOTTLES = 20
const SAMPLING_PORTS = 2

# Staff/Time constraints
const OPERATING_HOURS = (9, 16)  # 09:00-16:00
const BREAK_PERIOD = (12, 13)    # 12:00-13:00
const SHIFTS_PER_DAY = 2

# Weekend definition function
weekend_days() = Set([6, 7])

#====
Types
====#
abstract type NodeType end

# Process nodes
struct LoadingStart <: NodeType end
struct LoadingEnd <: NodeType end
struct PressureReading <: NodeType end
struct GasSampling <: NodeType end
struct VacuumDrying <: NodeType end
struct ReboundTest <: NodeType end
struct Storage <: NodeType end

# Staff nodes
struct ShiftStart <: NodeType end
struct ShiftEnd <: NodeType end
struct BreakStart <: NodeType end
struct BreakEnd <: NodeType end

# Resource nodes
struct PtAllocation <: NodeType end
struct VesselAllocation <: NodeType end
struct CaveAccess <: NodeType end
struct FgrrAccess <: NodeType end

# Control nodes
struct QualityCheck <: NodeType end
struct DecisionPoint <: NodeType end
struct ProcessStart <: NodeType end
struct ProcessEnd <: NodeType end

# Staff roles
abstract type StaffRole end

struct Operator <: StaffRole end
struct Supervisor <: StaffRole end
struct Technician <: StaffRole end
struct HealthPhysics <: StaffRole end

"""
Combined process and staff node representation
"""
mutable struct NuclearFacilityNode
    id::Int
    node_type::NodeType
    location::Symbol  # :eadr_cave, :fgrr_cave, :storage
    time_window::Tuple{Int,Int}  # Valid hours for operation
    required_staff::Vector{StaffRole}
    batch_id::Int
    resources::Dict{Symbol,Int}
    properties::Dict{Symbol,Any}
end

#====
Core Functions
====#
"""
Create sequence nodes for a single pin or batch operation
"""
function create_operation_sequence(
    batch_id::Int,
    is_single_pin::Bool,
    start_id::Int,
    shift_pattern::Dict{Int,Vector{StaffRole}}
)
    nodes = Dict{Int,NuclearFacilityNode}()
    current_id = start_id

    # Create loading sequence
    base_sequence = if is_single_pin
        [
            (LoadingStart(), :eadr_cave, [Operator(), HealthPhysics()]),
            (PtAllocation(), :eadr_cave, [Technician()]),
            (PressureReading(), :eadr_cave, [Technician(), Operator()]),
            (QualityCheck(), :eadr_cave, [Supervisor()]),
            (VesselAllocation(), :eadr_cave, [Operator()]),
            (CaveAccess(), :fgrr_cave, [HealthPhysics()]),
            (GasSampling(), :fgrr_cave, [Technician(), Operator()]),
            (FgrrAccess(), :fgrr_cave, [Operator()]),
            (VacuumDrying(), :eadr_cave, [Technician(), Operator()]),
            (ReboundTest(), :eadr_cave, [Technician()]),
            (PressureReading(), :eadr_cave, [Technician()]),
            (QualityCheck(), :eadr_cave, [Supervisor()]),
            (DecisionPoint(), :eadr_cave, [Supervisor()]),
            (Storage(), :storage, [Operator()])
        ]
    else
        # Batch processing sequence (abbreviated)
        [
            (LoadingStart(), :eadr_cave, [Operator(), HealthPhysics()]),
            (PtAllocation(), :eadr_cave, [Technician()]),
            (VesselAllocation(), :eadr_cave, [Operator()]),
            (GasSampling(), :fgrr_cave, [Technician(), Operator()]),
            (VacuumDrying(), :eadr_cave, [Technician(), Operator()]),
            (QualityCheck(), :eadr_cave, [Supervisor()]),
            (Storage(), :storage, [Operator()])
        ]
    end

    # Add shift boundaries around operations
    for (day, staff) in shift_pattern
        morning_id = current_id + day*100
        afternoon_id = morning_id + 50
        
        # Morning shift
        nodes[morning_id] = NuclearFacilityNode(
            morning_id,
            ShiftStart(),
            :facility,
            (9, 12),
            staff,
            batch_id,
            Dict(),
            Dict(:shift => "morning")
        )
        
        # Afternoon shift  
        nodes[afternoon_id] = NuclearFacilityNode(
            afternoon_id,
            ShiftStart(), 
            :facility,
            (13, 16),
            staff,
            batch_id,
            Dict(),
            Dict(:shift => "afternoon")
        )
    end

    # Create operation nodes with staff requirements
    for (op_type, location, staff) in base_sequence
        nodes[current_id] = NuclearFacilityNode(
            current_id,
            op_type,
            location,
            (9, 16),  # Full day window
            staff,
            batch_id,
            get_resource_requirements(op_type),
            Dict(
                :duration => get_operation_duration(op_type),
                :requires_supervision => any(s -> s isa Supervisor, staff),
                :radiation_monitor => any(s -> s isa HealthPhysics, staff)
            )
        )
        current_id += 1
    end

    return nodes
end

"""
Helper function to get resource requirements for operation types
"""
function get_resource_requirements(op_type::NodeType)
    requirements = Dict{Symbol,Int}()
    
    if op_type isa PtAllocation
        requirements[:pressure_transducers] = 1
    elseif op_type isa VesselAllocation
        requirements[:vessels] = 1
    elseif op_type isa GasSampling
        requirements[:sample_bottles] = 1
        requirements[:sampling_ports] = 1
    end
    
    return requirements
end

"""
Helper function to get operation durations
"""
function get_operation_duration(op_type::NodeType)
    durations = Dict(
        LoadingStart => 60,    # 1 hour
        PtAllocation => 30,    # 30 minutes
        PressureReading => 45, # 45 minutes
        VesselAllocation => 30,
        GasSampling => 90,     # 1.5 hours
        VacuumDrying => 120,   # 2 hours
        ReboundTest => 60,
        Storage => 30
    )
    
    return get(durations, typeof(op_type), 30)  # Default 30 minutes
end

#====
Network Generation
====#
"""
Generate full nuclear facility network
"""
function generate_nuclear_facility_network(
    n_single_pins::Int=10,
    n_batches::Int=4,
    n_weeks::Int=4
)
    all_nodes = Dict{Int,NuclearFacilityNode}()
    current_id = 1
    
    # Create staff shift patterns
    shift_patterns = Dict{Int,Vector{StaffRole}}()
    for week in 1:n_weeks
        for day in 1:5  # Monday-Friday
            shift_patterns[day + (week-1)*7] = [
                Operator(),
                Supervisor(),
                Technician(),
                HealthPhysics()
            ]
        end
    end
    
    # Create operation sequences
    for batch_id in 1:(n_single_pins + n_batches)
        is_single = batch_id ≤ n_single_pins
        merge!(
            all_nodes,
            create_operation_sequence(
                batch_id,
                is_single,
                current_id,
                shift_patterns
            )
        )
        current_id += is_single ? 50 : 30
    end
    
    # Create graph structure
    n_nodes = length(all_nodes)
    dag = SimpleDiGraph(n_nodes)
    
    # Add edges
    add_sequence_edges!(dag, all_nodes)
    add_resource_edges!(dag, all_nodes)
    add_staff_edges!(dag, all_nodes)
    
    return (
        graph = dag,
        nodes = all_nodes
    )
end

"""
Add sequence edges to the graph
"""
function add_sequence_edges!(dag::SimpleDiGraph, nodes::Dict{Int,NuclearFacilityNode})
    sorted_ids = sort(collect(keys(nodes)))
    
    for i in 1:(length(sorted_ids)-1)
        add_edge!(dag, sorted_ids[i], sorted_ids[i+1])
    end
end

"""
Add resource constraint edges
"""
function add_resource_edges!(dag::SimpleDiGraph, nodes::Dict{Int,NuclearFacilityNode})
    # Add edges between nodes that use the same resources
    for (id1, node1) in nodes
        for (id2, node2) in nodes
            if id1 < id2 && !isempty(intersect(keys(node1.resources), keys(node2.resources)))
                add_edge!(dag, id1, id2)
            end
        end
    end
end

"""
Add staff dependency edges
"""
function add_staff_edges!(dag::SimpleDiGraph, nodes::Dict{Int,NuclearFacilityNode})
    # Add edges between nodes that require the same staff
    for (id1, node1) in nodes
        for (id2, node2) in nodes
            if id1 < id2 && !isempty(intersect(node1.required_staff, node2.required_staff))
                add_edge!(dag, id1, id2)
            end
        end
    end
end

#====
Exports
====#
export NuclearFacilityNode, NodeType, StaffRole,
       LoadingStart, LoadingEnd, PressureReading, GasSampling,
       VacuumDrying, ReboundTest, Storage,
       ShiftStart, ShiftEnd, BreakStart, BreakEnd,
       PtAllocation, VesselAllocation, CaveAccess, FgrrAccess,
       QualityCheck, DecisionPoint, ProcessStart, ProcessEnd,
       Operator, Supervisor, Technician, HealthPhysics,
       create_operation_sequence, generate_nuclear_facility_network

end # module

