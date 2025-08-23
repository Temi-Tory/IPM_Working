// JavaScript to parse the complete network data from your files
// This will read and process all 782 nodes and 2791 edges

async function parseNetworkData() {
    // Read the node mapping file content (you'll need to copy this from your file)
    const nodeMappingCSV = `Hybrid_Node_ID,Drone_Facility_ID,Facility_Name,Node_Type,Latitude,Longitude,Network_Role
719,166,"Riverside Resource Centre",H,55.87101907,-4.294682696,CLUSTER_NODE
699,107,"Hawick Psychogeriatric Day Hospital",H,55.41944947,-2.788906805,CLUSTER_NODE
319,188,"Stephen Cottage Hospital",H,57.4459224,-3.122858852,CLUSTER_NODE
687,253,"Whitburn Day Hospital",H,55.86709634,-3.687680614,CLUSTER_NODE
185,208,"Glencoe Hospital",H,56.68504892,-5.096778442,CLUSTER_NODE
420,185,"Ugie Hospital",H,57.51538041,-1.792753795,CLUSTER_NODE
525,33,"Tiree Airport",A,56.49919891,-6.869170189,CLUSTER_NODE
365,20,"Queen Elizabeth University Hospital",H,55.86270871,-4.336845035,CLUSTER_NODE
638,1,"University Hospital Crosshouse",H,55.61397859,-4.538174149,CLUSTER_NODE
263,98,"Three Towns Resource Centre",H,55.6396381,-4.770025661,CLUSTER_NODE
422,288,"St Brendans Cot Hospital",H,56.95228577,-7.496280665,CLUSTER_NODE
242,125,"Laurel Bank (CETU)",H,55.06292255,-3.602475871,CLUSTER_NODE
183,210,"Ross Memorial Hospital",H,57.59470653,-4.416007475,CLUSTER_NODE
551,95,"Maybole Day Hospital",H,55.35471481,-4.680353228,CLUSTER_NODE
224,156,"Leverndale Hospital",H,55.83539782,-4.365218663,CLUSTER_NODE
694,286,"Bluebell Intermediary Care Unit",H,56.45943886,-3.048319896,CLUSTER_NODE
692,183,"Turriff Cottage Hospital",H,57.53734207,-2.449308321,CLUSTER_NODE
177,217,"Coathill Hospital",H,55.84868464,-4.024619696,CLUSTER_NODE
676,44,"new",new,56.54605839,-4.733614026,CLUSTER_NODE
637,119,"Thornhill Hospital",H,55.23567518,-3.765209858,CLUSTER_NODE
730,200,"Dunbar Hospital",H,58.58451762,-3.538168965,CLUSTER_NODE
523,254,"St John's Hospital",H,55.89302304,-3.518009928,CLUSTER_NODE
77,107,"Hawick Psychogeriatric Day Hospital",H,55.41944947,-2.788906805,POWER_BACKBONE
172,226,"Strathclyde Hospital",H,55.78452134,-4.00085727,CLUSTER_NODE
685,157,"Mearnskirk House",H,55.76115855,-4.329952242,CLUSTER_NODE
103,289,"Uist & Barra Hospital",H,57.47272244,-7.377046305,POWER_BACKBONE
526,252,"Tippethill Hospital",H,55.87680395,-3.686279247,CLUSTER_NODE
59,154,"Shawpark Resource Centre",H,55.88855482,-4.285921346,POWER_BACKBONE
773,288,"St Brendans Cot Hospital",H,56.95228577,-7.496280665,CLUSTER_NODE
211,171,"Netherton",H,55.89505605,-4.329415592,CLUSTER_NODE`;

    const edgesCSV = `source,destination
1,2
2,3
2,6
2,10
3,4
4,5
5,13
6,5
7,8
8,9
8,12
9,10
10,11
11,19
12,11
13,14
14,21
15,13
16,15
16,17
17,14
18,16
19,20
19,22
20,21
21,22
22,23
24,25
25,26
25,29
25,33
26,27
27,28
28,36
29,28
30,31
31,32
31,35
32,33
33,34
34,42
35,34
36,37
37,44
38,36
39,38
39,40
40,37
41,39
42,43
42,45
43,44
44,45
45,46
47,48
48,49
48,52
48,56
49,50
50,51
51,59
52,51
53,54
54,55
54,58
55,56
56,57
57,65
58,57
59,60
60,67
61,59
62,61
62,63
63,60
64,62
65,66
65,68
66,67
67,68
68,69
70,71
71,72
71,75
71,79
72,73
73,74
74,82
75,74
76,77
77,78
77,81
78,79
79,80
80,88
81,80
82,83
83,90
84,82
85,84
85,86
86,83
87,85
88,89
88,91
89,90
90,91
91,92
93,94
94,95
94,98
94,102
95,96
96,97
97,105
98,97
99,100
100,101
100,104
101,102
102,103
103,111
104,103
105,106
106,113
107,105
108,107
108,109
109,106
110,108
111,112
111,114
112,113
113,114
114,115
22,24
23,30
21,38
45,47
46,53
44,61
68,70
69,76
67,84
91,93
92,99
90,107
1,120
1,121
1,122
1,123
1,124
1,125
1,126
1,127
1,128
1,129
1,130
116,131
116,132
116,133
116,134
116,120
116,121
116,122
116,123
116,124
116,125
116,126
116,127
117,128
117,129
117,130
117,131
117,132
117,133
117,134
117,120
117,121
117,122
118,123
118,124
118,125
118,126
118,127
118,128
118,129
118,130
118,131
118,132
118,133
118,134
118,120
119,121
119,122
119,123
119,124
119,125
119,126
119,127
119,128
119,129
119,130
119,131
119,132
120,135
120,136
120,137
120,138
120,139
120,140
120,141
120,142
121,143
121,144
123,135
123,136
123,137
123,138
123,139
124,140
124,141
124,142
124,143
124,144
126,135
126,136
127,137
127,138
127,139
127,140
127,141
127,142
127,143
127,144
129,135
130,136
130,137
130,138
130,139
130,140
130,141
130,142
130,143
131,144
133,135
133,136
133,137
133,138
133,139
133,140
133,141
134,142
134,143
134,144
1,144
117,139
117,141
119,137`;

    // Parse nodes
    const nodeLines = nodeMappingCSV.trim().split('\n');
    const nodes = [];
    
    for (let i = 1; i < nodeLines.length; i++) { // Skip header
        const line = nodeLines[i];
        const parts = line.split(',');
        if (parts.length >= 7) {
            const id = parts[1].trim();
            const name = parts[2].replace(/"/g, '').trim();
            const type = parts[3].trim();
            const lat = parseFloat(parts[4]);
            const lng = parseFloat(parts[5]);
            const role = parts[6].trim();
            
            nodes.push({
                id: id,
                name: name,
                type: type,
                lat: lat,
                lng: lng,
                role: role,
                connections: 0 // Will be calculated
            });
        }
    }

    // Parse edges
    const edgeLines = edgesCSV.trim().split('\n');
    const edges = [];
    const connectionCount = {};
    
    for (let i = 1; i < edgeLines.length; i++) { // Skip header
        const parts = edgeLines[i].split(',');
        if (parts.length >= 2) {
            const source = parts[0].trim();
            const target = parts[1].trim();
            
            edges.push({ source: source, target: target });
            
            // Count connections
            connectionCount[source] = (connectionCount[source] || 0) + 1;
            connectionCount[target] = (connectionCount[target] || 0) + 1;
        }
    }

    // Update connection counts
    nodes.forEach(node => {
        node.connections = connectionCount[node.id] || 0;
    });

    return { nodes, edges };
}

// Export the data parsing function
window.parseNetworkData = parseNetworkData;