using CSV, DataFrames

function verify_node_mappings()
    println("=== Node Mapping Verification Script ===\n")
    
    # Read the CSV file
    csv_file = "csvfiles/drone_info/nodes.csv"
    mapping_file = "dag_ntwrk_files/drone-medical-delivery-network/drone-medical-delivery-network-node-mapping.txt"
    
    println("Reading files...")
    nodes_df = CSV.read(csv_file, DataFrame)
    mapping_df = CSV.read(mapping_file, DataFrame)
    
    println("CSV file has $(nrow(nodes_df)) rows")
    println("Mapping file has $(nrow(mapping_df)) rows\n")
    
    # Check if Drone_Facility_ID matches numberID
    println("=== Checking Facility ID Mapping ===")
    csv_ids = Set(nodes_df.numberID)
    mapping_ids = Set(mapping_df.Drone_Facility_ID)
    
    # Find IDs in CSV but not in mapping
    missing_in_mapping = setdiff(csv_ids, mapping_ids)
    # Find IDs in mapping but not in CSV
    missing_in_csv = setdiff(mapping_ids, csv_ids)
    
    println("CSV unique numberIDs: $(length(csv_ids))")
    println("Mapping unique Drone_Facility_IDs: $(length(mapping_ids))")
    
    if length(missing_in_mapping) > 0
        println("\n❌ IDs in CSV but NOT in mapping file:")
        for id in sort(collect(missing_in_mapping))
            csv_row = nodes_df[nodes_df.numberID .== id, :]
            if nrow(csv_row) > 0
                println("  ID $id: $(csv_row.info[1])")
            end
        end
    end
    
    if length(missing_in_csv) > 0
        println("\n❌ IDs in mapping but NOT in CSV file:")
        for id in sort(collect(missing_in_csv))
            mapping_rows = mapping_df[mapping_df.Drone_Facility_ID .== id, :]
            if nrow(mapping_rows) > 0
                println("  ID $id: $(mapping_rows.Facility_Name[1])")
            end
        end
    end
    
    if length(missing_in_mapping) == 0 && length(missing_in_csv) == 0
        println("✅ All facility IDs match between files!")
    end
    
    # Check coordinate consistency for matching IDs
    println("\n=== Checking Coordinate Consistency ===")
    coordinate_mismatches = 0
    
    for id in intersect(csv_ids, mapping_ids)
        csv_row = nodes_df[nodes_df.numberID .== id, :]
        mapping_rows = mapping_df[mapping_df.Drone_Facility_ID .== id, :]
        
        if nrow(csv_row) > 0 && nrow(mapping_rows) > 0
            csv_lat = csv_row.lat[1]
            csv_lon = csv_row.lon[1]
            
            # Check all mapping rows for this ID (there might be multiple)
            for i in 1:nrow(mapping_rows)
                map_lat = mapping_rows.Latitude[i]
                map_lon = mapping_rows.Longitude[i]
                
                # Allow small floating point differences
                lat_diff = abs(csv_lat - map_lat)
                lon_diff = abs(csv_lon - map_lon)
                
                if lat_diff > 1e-6 || lon_diff > 1e-6
                    coordinate_mismatches += 1
                    println("❌ Coordinate mismatch for ID $id:")
                    println("   CSV: lat=$csv_lat, lon=$csv_lon")
                    println("   Mapping: lat=$map_lat, lon=$map_lon")
                    println("   Facility: $(csv_row.info[1])")
                    println()
                end
            end
        end
    end
    
    if coordinate_mismatches == 0
        println("✅ All coordinates match between files!")
    else
        println("❌ Found $coordinate_mismatches coordinate mismatches")
    end
    
    # Check facility name consistency
    println("\n=== Checking Facility Name Consistency ===")
    name_mismatches = 0
    
    for id in intersect(csv_ids, mapping_ids)
        csv_row = nodes_df[nodes_df.numberID .== id, :]
        mapping_rows = mapping_df[mapping_df.Drone_Facility_ID .== id, :]
        
        if nrow(csv_row) > 0 && nrow(mapping_rows) > 0
            csv_name = strip(csv_row.info[1])
            
            # Check all mapping rows for this ID
            for i in 1:nrow(mapping_rows)
                map_name = strip(mapping_rows.Facility_Name[i])
                
                if csv_name != map_name
                    name_mismatches += 1
                    println("❌ Name mismatch for ID $id:")
                    println("   CSV: '$csv_name'")
                    println("   Mapping: '$map_name'")
                    println()
                end
            end
        end
    end
    
    if name_mismatches == 0
        println("✅ All facility names match between files!")
    else
        println("❌ Found $name_mismatches name mismatches")
    end
    
    # Check node type consistency
    println("\n=== Checking Node Type Consistency ===")
    type_mismatches = 0
    
    for id in intersect(csv_ids, mapping_ids)
        csv_row = nodes_df[nodes_df.numberID .== id, :]
        mapping_rows = mapping_df[mapping_df.Drone_Facility_ID .== id, :]
        
        if nrow(csv_row) > 0 && nrow(mapping_rows) > 0
            csv_type = csv_row.city_type[1]
            
            # Check all mapping rows for this ID
            for i in 1:nrow(mapping_rows)
                map_type = mapping_rows.Node_Type[i]
                
                if csv_type != map_type
                    type_mismatches += 1
                    println("❌ Type mismatch for ID $id:")
                    println("   CSV: '$csv_type'")
                    println("   Mapping: '$map_type'")
                    println("   Facility: $(csv_row.info[1])")
                    println()
                end
            end
        end
    end
    
    if type_mismatches == 0
        println("✅ All node types match between files!")
    else
        println("❌ Found $type_mismatches type mismatches")
    end
    
    # Summary statistics
    println("\n=== Summary ===")
    println("Total nodes in CSV: $(nrow(nodes_df))")
    println("Total mappings in network file: $(nrow(mapping_df))")
    println("Common facility IDs: $(length(intersect(csv_ids, mapping_ids)))")
    println("Multiple mappings per facility: $(nrow(mapping_df) - length(mapping_ids))")
    
    # Check for duplicate mappings
    duplicate_facilities = []
    for id in mapping_ids
        count = sum(mapping_df.Drone_Facility_ID .== id)
        if count > 1
            push!(duplicate_facilities, (id, count))
        end
    end
    
    if length(duplicate_facilities) > 0
        println("\n📊 Facilities with multiple network mappings:")
        for (id, count) in duplicate_facilities
            facility_name = mapping_df[mapping_df.Drone_Facility_ID .== id, :Facility_Name][1]
            println("   ID $id ($facility_name): $count mappings")
        end
    end
    
    println("\n=== Verification Complete ===")
end

# Run the verification
verify_node_mappings()
