 generated a Pareto front of network designs. The design was based on a fixed set of locations, but the optimiser could choose not to place infrastructure at the non-hospital locations. There were 3 optimisation objectives:

 

Minimise capital cost. I assigned arbitrary costs to each type of infrastructure, i.e. smaller/larger drone ports cost less/more.
Maximise resilience. Resilience was measured as the average efficiency of the network across the failure cases. In this case, I randomly disabled 20% of the nodes in 10 different cases. Efficiency is measured based on the increase in delivery times for each mission compared to the nominal case, with a failed mission having 0 efficiency: 
Minimise time. This is the total time it takes the network to complete all of the nominal missions. In this case, I assigned a 'hub' node to each health board, and scheduled deliveries between each ordered pair of hubs. I then additionally scheduled a delivery from every hub to each of the hospitals in its health board.
 

I attached a plot of the Pareto front with one of the low-capital-cost solutions highlighted with a red arrow. I then also attached information about this particular network design in the other png file and the excel file. The picture of Scotland shows the node locations and the nominal mission routes between them, not every possible feasible link, and not the actual paths the drones fly in. The excel file contains all the lats/lons and matrices for feasible links for the smaller VTOL drone and the larger fixed-wing airport drone, if the cell is not inf then it's feasible.

 

Hope this covers what you needed!