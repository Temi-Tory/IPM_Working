#!/usr/bin/env julia

"""
Test Runner for CapacityAnalysisModule

This script runs the comprehensive test suite to validate the accuracy 
of your CapacityAnalysisModule.jl implementation.

Usage:
    julia run_tests.jl [test_type]
    
Where test_type can be:
    all     - Run all tests (default)
    quick   - Run basic functionality tests only
    debug   - Run specific test case for debugging

Examples:
    julia run_tests.jl
    julia run_tests.jl quick  
    julia run_tests.jl debug linear
"""

# Add current directory to load path if needed
if pwd() ∉ LOAD_PATH
    push!(LOAD_PATH, pwd())
end

# Load the test suite
try
    include("CapacityAnalysisModule_Tests.jl")
catch e
    println("❌ Error loading test suite: $e")
    println("Make sure you're running this from the correct directory")
    exit(1)
end

function main()
    args = ARGS
    
    if length(args) == 0 || args[1] == "all"
        println("Running comprehensive test suite...")
        results = run_all_tests()
        
        # Exit with error code if tests failed
        if results.failed > 0
            exit(1)
        end
        
    elseif args[1] == "quick"
        println("Running quick validation tests...")
        success = run_quick_tests()
        
        if !success
            exit(1)
        end
        
    elseif args[1] == "debug"
        if length(args) < 2
            println("❌ Debug mode requires a test case name")
            println("Available cases: linear, diamond, multi_source, precision, consistency, paths, validation, stress")
            exit(1)
        end
        
        test_case = args[2]
        println("Running debug test for: $test_case")
        results = debug_specific_case(test_case)
        
        if results.failed > 0
            exit(1)
        end
        
    else
        println("❌ Unknown test type: $(args[1])")
        println("Use: all, quick, or debug [case_name]")
        exit(1)
    end
    
    println("✅ Test execution completed successfully")
end

# Run main function
if abspath(PROGRAM_FILE) == @__FILE__
    main()
end