"Analyzing diamond hierarchy with global optimization and memoization applied...\n"
DiamondHierarchyNode[DiamondHierarchyNode(0, Diamond(Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)]), Set([13, 3, 1]), 16, nothing, DiamondHierarchyNode[DiamondHierarchyNode(1, Diamond(Set([5, 16, 12, 8, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([5]), [(5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11      
6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (14, 15), (15, 16), (2, 6), (13, 9), (13, 14), (3, 7)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (13, 9), (13, 14), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 
10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (13, 9), (13, 14), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])])]), DiamondHierarchyNode(2, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), 
(3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 16, 12, 8, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([5]), [(5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (14, 15), (15, 16), (2, 6), (13, 9), (13, 14), (3, 7)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 
6), (3, 7), (13, 9)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(2, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), Set([13]), 12, Diamond(Set([5, 16, 12, 8, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([5]), [(5, 6), (5, 9), (6, 7), (7, 8), (7, 11), 
(8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (14, 15), (15, 16), (2, 6), (13, 9), (13, 14), (3, 7)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 
11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 
10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])])]), DiamondHierarchyNode(2, Diamond(Set([5, 13, 10, 9, 14]), Set([13]), [(9, 10), (10, 14), (13, 9), (13, 14), (5, 9)]), Set([13]), 14, Diamond(Set([5, 16, 12, 8, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([5]), [(5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (14, 15), (15, 16), (2, 6), (13, 9), (13, 14), (3, 7)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)]), DiamondHierarchyNode[]), DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), 
[(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 3, 1]), [(1, 
2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(1, Diamond(Set([5, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (13, 9), (13, 14), (5, 6), (2, 6), (3, 7), (5, 9)]), Set([13]), 15, Diamond(Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (13, 9), (13, 14), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (13, 9), (13, 14), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])])]), DiamondHierarchyNode(1, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), Set([13]), 12, Diamond(Set([5, 16, 12, 8, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (10, 14), (11, 12), (11, 15), (12, 16), (13, 9), (13, 14), (14, 15), (15, 16)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), 
(3, 7), (13, 9)]), DiamondHierarchyNode[])])])]), DiamondHierarchyNode(0, Diamond(Set([5, 8, 1, 6, 9, 3, 7, 4, 13, 2, 10]), Set([3, 1]), [(2, 6), (3, 2), (3, 4), (3, 7), (6, 7), (7, 8), (8, 4), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), Set([3, 1]), 4, nothing, DiamondHierarchyNode[DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 8, 1, 6, 9, 3, 7, 4, 13, 2, 10]), Set([3, 1]), [(2, 6), (3, 2), (3, 4), (3, 7), (6, 7), (7, 8), (8, 4), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(0, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 1]), [(1, 2), (1, 5), (2, 6), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 7), (3, 2)]), Set([13, 1]), 15, nothing, DiamondHierarchyNode[DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 1]), [(1, 2), (1, 5), (2, 6), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 7), (3, 2)]), DiamondHierarchyNode[]), DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 7, 2, 10, 9, 3, 1]), Set([3]), [(2, 6), (6, 7), (3, 7), (3, 2), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), Set([3]), 7, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 1]), [(1, 2), (1, 5), (2, 6), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 7), (3, 2)]), DiamondHierarchyNode[DiamondHierarchyNode(2, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (3, 2), (13, 9)]), Set([1]), 6, Diamond(Set([5, 13, 6, 
7, 2, 10, 9, 3, 1]), Set([3]), [(2, 6), (6, 7), (3, 7), (3, 2), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (3, 2), (13, 9)]), DiamondHierarchyNode[])])]), DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3, 1]), Set([5, 3]), [(5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), 
(2, 6), (3, 7), (13, 9), (3, 2), (1, 2)]), Set([5, 3]), 11, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([13, 1]), [(1, 2), (1, 5), (2, 6), (5, 6), (5, 9), (6, 7), (7, 11), (9, 
10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 7), (3, 2)]), DiamondHierarchyNode[DiamondHierarchyNode(2, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3, 1]), Set([5, 3]), [(5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (2, 6), (3, 7), (13, 9), (3, 2), (1, 2)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(1, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 15, 2, 10]), Set([5, 13, 3, 1]), [(5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (14, 15), (2, 6), (3, 7), (13, 9), (13, 14), (3, 2), (1, 2)]), Set([5, 13, 3, 1]), 15, Diamond(Set([5, 1, 6, 11, 9, 14, 3, 7, 13, 
15, 2, 10]), Set([13, 1]), [(1, 2), (1, 5), (2, 6), (5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (10, 14), (11, 15), (13, 9), (13, 14), (14, 15), (3, 7), (3, 2)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(0, Diamond(Set([5, 12, 8, 1, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9)]), Set([13, 3, 1]), 12, nothing, DiamondHierarchyNode[DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 12, 8, 1, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 
11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(1, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 12, 8, 1, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), 
[(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(1, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), Set([13]), 12, Diamond(Set([5, 12, 8, 1, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13, 3, 1]), [(1, 2), (1, 5), (2, 6), (3, 2), (3, 
7), (5, 6), (5, 9), (6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[]), DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), Set([5]), 11, Diamond(Set([5, 12, 8, 6, 11, 9, 3, 7, 13, 2, 10]), Set([13]), [(6, 7), (7, 8), (7, 11), (8, 12), (9, 10), (10, 6), (10, 11), (11, 12), (13, 9), (5, 6), (2, 6), (3, 7), (5, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(4, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3]), Set([5]), [(6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (5, 6), (5, 9), (2, 6), (3, 7), (13, 9)]), DiamondHierarchyNode[])])])]), DiamondHierarchyNode(0, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3, 1]), Set([5, 3]), [(5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (2, 6), (3, 7), (13, 9), (3, 2), (1, 2)]), Set([5, 3]), 11, nothing, DiamondHierarchyNode[DiamondHierarchyNode(2, Diamond(Set([5, 6, 7, 11, 10, 2, 3]), Set([10]), [(6, 7), (7, 11), (10, 6), (10, 11), (5, 6), (2, 6), (3, 7)]), Set([10]), 11, Diamond(Set([5, 13, 6, 7, 11, 10, 2, 9, 3, 1]), Set([5, 3]), [(5, 6), (5, 9), (6, 7), (7, 11), (9, 10), (10, 6), (10, 11), (2, 6), (3, 7), (13, 9), (3, 2), (1, 2)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(0, Diamond(Set([5, 13, 6, 7, 2, 10, 9, 3, 1]), Set([3]), [(2, 6), (6, 7), (3, 7), (3, 2), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), Set([3]), 7, nothing, DiamondHierarchyNode[DiamondHierarchyNode(2, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (3, 2), (13, 9)]), Set([1]), 6, Diamond(Set([5, 13, 6, 7, 2, 10, 9, 3, 1]), Set([3]), [(2, 6), (6, 7), (3, 7), (3, 2), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (13, 9)]), DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (3, 2), (13, 9)]), DiamondHierarchyNode[])])]), DiamondHierarchyNode(0, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 
5), (5, 9), (9, 10), (3, 2), (13, 9)]), Set([1]), 6, nothing, DiamondHierarchyNode[DiamondHierarchyNode(3, Diamond(Set([5, 13, 6, 10, 9]), Set([5]), [(9, 10), (10, 6), (5, 6), (5, 9), (13, 9)]), Set([5]), 6, Diamond(Set([5, 13, 6, 2, 10, 9, 3, 1]), Set([1]), [(2, 6), (5, 6), (10, 6), (1, 2), (1, 5), (5, 9), (9, 10), (3, 2), (13, 9)]), DiamondHierarchyNode[])]), DiamondHierarchyNode(0, Diamond(Set([5, 13, 10, 9, 14]), Set([13]), [(9, 10), (10, 14), (13, 9), (13, 14), (5, 9)]), Set([13]), 14, nothing, DiamondHierarchyNode[])]