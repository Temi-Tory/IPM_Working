include(joinpath(@__DIR__, "server.jl"))
using .InfoPropServer

InfoPropServer.start_server()
