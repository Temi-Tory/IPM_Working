# UI Component Code Examples & Visual Prototypes

Ready-to-implement React/Vue components for capacity analysis UI.

---

## Component 1: Flow Overview Card

### Visual Mock-up
```
╔═══════════════════════════════════════╗
║        NETWORK THROUGHPUT             ║
╠═══════════════════════════════════════╣
║                                       ║
║         52.45                         ║
║        units/time                     ║
║                                       ║
║  Available: 84.0  │  Achieved: 52.45  ║
║  Constrained: 37.6%                   ║
║                                       ║
║  [████████████░░░░░░░░░░░░░░░░░░░░]   ║
║  Operating at 62.5% of available      ║
║                                       ║
║  Status: ⚠️  MODERATE CONSTRAINT      ║
║                                       ║
╚═══════════════════════════════════════╝
```

### React Implementation
```jsx
import React from 'react';

const FlowOverviewCard = ({ response }) => {
  // Destructure key fields
  const maxFlow = response.total_max_flow || 0;
  const sourceTotal = response.source_rates?.reduce((a,b) => a+b, 0) || 0;
  const constrainedPercent = ((1 - maxFlow/sourceTotal) * 100).toFixed(1);
  const operatingPercent = ((maxFlow/sourceTotal) * 100).toFixed(1);
  
  // Determine status color
  const getStatusColor = (percent) => {
    if (percent > 90) return 'green';
    if (percent > 70) return 'yellow';
    if (percent > 50) return 'orange';
    return 'red';
  };
  
  const statusColor = getStatusColor(operatingPercent);
  const statusText = {
    green: "✅ Good - Ample capacity",
    yellow: "⚠️ Moderate - Some constraints",
    orange: "🟠 High - Getting tight",
    red: "🔴 Critical - Severe bottleneck"
  }[statusColor];

  return (
    <div className={`flow-card status-${statusColor}`}>
      <h2>Network Throughput</h2>
      
      <div className="metric-large">
        <span className="value">{maxFlow.toFixed(2)}</span>
        <span className="unit">units/time</span>
      </div>
      
      <div className="comparison">
        <div>Available: {sourceTotal.toFixed(1)}</div>
        <div>Achieved: {maxFlow.toFixed(2)}</div>
        <div>Constrained: {constrainedPercent}%</div>
      </div>
      
      <div className="progress-bar">
        <div 
          className="progress-fill"
          style={{ width: `${operatingPercent}%` }}
        ></div>
      </div>
      <span className="progress-label">
        Operating at {operatingPercent}% of available
      </span>
      
      <div className={`status status-${statusColor}`}>
        {statusText}
      </div>
    </div>
  );
};

export default FlowOverviewCard;
```

### CSS Styling
```css
.flow-card {
  border-radius: 8px;
  padding: 20px;
  min-width: 300px;
  border-left: 4px solid;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  background: white;
}

.flow-card.status-green {
  border-left-color: #22c55e;
  background: #f0fdf4;
}

.flow-card.status-yellow {
  border-left-color: #eab308;
  background: #fefce8;
}

.flow-card.status-orange {
  border-left-color: #f97316;
  background: #fff7ed;
}

.flow-card.status-red {
  border-left-color: #ef4444;
  background: #fef2f2;
}

.metric-large {
  text-align: center;
  margin: 20px 0;
  font-size: 48px;
  font-weight: bold;
  color: #1f2937;
}

.metric-large .unit {
  font-size: 14px;
  color: #6b7280;
  margin-left: 8px;
}

.comparison {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 10px;
  margin: 15px 0;
  text-align: center;
  font-size: 14px;
}

.progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin: 12px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #10b981);
  transition: width 0.3s ease;
}

.status {
  margin-top: 12px;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
  font-weight: 500;
}
```

---

## Component 2: Bottleneck Indicator

### Visual Mock-up
```
╔═══════════════════════════════════════╗
║     PRIMARY BOTTLENECK                ║
╠═══════════════════════════════════════╣
║                                       ║
║  ⚙️  NODE PROCESSING BOTTLENECK       ║
║                                       ║
║  Component:     Node 11               ║
║  Utilization:   100%  🔴              ║
║  Type:          Processing Hub        ║
║  Impact:        Limits flow by 31.55  ║
║                                       ║
║  Recommendation:                      ║
║  Upgrade node processing to 25 units  ║
║  Expected improvement: +4.2 units     ║
║                                       ║
╚═══════════════════════════════════════╝
```

### React Implementation
```jsx
import React from 'react';

const BottleneckIndicator = ({ response }) => {
  const bottleneck = response.bottlenecks || {};
  const type = bottleneck.bottleneck_type || 'unknown';
  
  const typeConfig = {
    transmission: { icon: '📡', color: '#3b82f6', name: 'TRANSMISSION BOTTLENECK' },
    node_processing: { icon: '⚙️', color: '#a855f7', name: 'NODE PROCESSING BOTTLENECK' },
    mixed: { icon: '⚔️', color: '#f97316', name: 'MIXED BOTTLENECK' },
    source_limited: { icon: '📤', color: '#22c55e', name: 'SOURCE LIMITED' }
  };
  
  const config = typeConfig[type] || typeConfig.unknown;
  
  // Find primary saturated component
  let primaryComponent = null;
  let componentType = null;
  
  if (bottleneck.saturated_nodes?.length > 0) {
    primaryComponent = `Node ${bottleneck.saturated_nodes[0]}`;
    componentType = 'node';
  } else if (bottleneck.saturated_edges?.length > 0) {
    const [src, dst] = bottleneck.saturated_edges[0];
    primaryComponent = `Edge (${src},${dst})`;
    componentType = 'edge';
  }
  
  // Calculate flow impact
  const maxFlow = response.total_max_flow || 0;
  const sourceTotal = response.source_rates?.reduce((a,b) => a+b, 0) || 0;
  const flowLoss = sourceTotal - maxFlow;
  
  // Get recommendation text
  const recommendation = response.comparative_analysis?.strategic_recommendation || 
    'Analyze network topology for bottleneck resolution.';

  return (
    <div className="bottleneck-indicator" style={{ borderColor: config.color }}>
      <h3>{config.icon} {config.name}</h3>
      
      <div className="bottleneck-details">
        <div className="detail-row">
          <span className="label">Component:</span>
          <span className="value">{primaryComponent}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Utilization:</span>
          <span className="value utilization-100">100% 🔴</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Type:</span>
          <span className="value">{componentType === 'node' ? 'Node (Processing)' : 'Edge (Transmission)'}</span>
        </div>
        
        <div className="detail-row">
          <span className="label">Impact:</span>
          <span className="value">{`Limits flow by ${flowLoss.toFixed(2)} units`}</span>
        </div>
      </div>
      
      <div className="recommendation-box">
        <h4>💡 Recommendation</h4>
        <p>{recommendation}</p>
      </div>
    </div>
  );
};

export default BottleneckIndicator;
```

### CSS Styling
```css
.bottleneck-indicator {
  border-left: 5px solid;
  padding: 16px;
  border-radius: 6px;
  background: #fff;
  margin: 12px 0;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.bottleneck-indicator h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  font-weight: 600;
}

.bottleneck-details {
  background: #f9fafb;
  padding: 12px;
  border-radius: 4px;
  margin: 12px 0;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  font-size: 14px;
}

.detail-row .label {
  color: #6b7280;
  font-weight: 500;
}

.detail-row .value {
  color: #1f2937;
  font-weight: 600;
}

.detail-row .utilization-100 {
  color: #dc2626;
  font-weight: 700;
}

.recommendation-box {
  background: #eff6ff;
  border-left: 3px solid #0284c7;
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
}

.recommendation-box h4 {
  margin: 0 0 8px 0;
  font-size: 13px;
  font-weight: 600;
}

.recommendation-box p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #1e40af;
}
```

---

## Component 3: Saturated Components List

### Visual Mock-up
```
SATURATED COMPONENTS
────────────────────────────────────────────
🔴 Node 11
   Utilization: 100% [████████████]
   Current: 20.96 / 20.96 units
   Type: Hub (5 inputs, 3 outputs)
   Redundancy: NONE (SPOF)

NEAR-SATURATED COMPONENTS  
────────────────────────────────────────────
🟠 Node 19
   Utilization: 92% [███████████░]
   Current: 29.44 / 32.00 units  
   Headroom: 2.56 units
   
🟡 Edge (11,19)
   Utilization: 98% [████████████░]
   Current: 14.28 / 14.56 units
   Headroom: 0.28 units
```

### React Implementation
```jsx
const SaturatedComponentsList = ({ response }) => {
  const bottleneck = response.bottlenecks || {};
  const utilByComp = bottleneck.utilization_by_component || {};
  
  // Parse node flows
  const nodeFlows = response.node_flows || {};
  const edgeFlows = response.edge_flows || {};
  
  // Get network metadata (needed to find capacities)
  const nodeCapacities = response.network_metadata?.node_capacities || {};
  const edgeCapacities = response.network_metadata?.edge_capacities || {};
  
  // Create saturated list
  const saturatedItems = [];
  
  // Add saturated nodes
  (bottleneck.saturated_nodes || []).forEach(nodeId => {
    const flow = nodeFlows[nodeId] || 0;
    const capacity = nodeCapacities[nodeId] || flow; // Assume saturated = at capacity
    saturatedItems.push({
      type: 'node',
      id: nodeId,
      flow,
      capacity,
      utilization: 1.0,
      isNearSat: false
    });
  });
  
  // Add near-saturated nodes
  (bottleneck.near_saturated_nodes || []).forEach(nodeId => {
    const flow = nodeFlows[nodeId] || 0;
    const capacity = nodeCapacities[nodeId] || flow;
    const util = flow / capacity;
    saturatedItems.push({
      type: 'node',
      id: nodeId,
      flow,
      capacity,
      utilization: util,
      isNearSat: true
    });
  });
  
  // Similar for edges...
  (bottleneck.saturated_edges || []).forEach(edge => {
    saturatedItems.push({
      type: 'edge',
      edge,
      utilization: 1.0,
      isNearSat: false
    });
  });
  
  const renderItem = (item) => {
    const utilPercent = (item.utilization * 100).toFixed(1);
    const headroom = ((1 - item.utilization) * item.capacity).toFixed(2);
    const barFill = Math.min(item.utilization * 100, 100);
    
    if (item.type === 'node') {
      return (
        <div key={`node-${item.id}`} className={`component-item ${item.isNearSat ? 'near-sat' : 'saturated'}`}>
          <div className="item-header">
            <span className="item-icon">{item.isNearSat ? '🟠' : '🔴'}</span>
            <span className="item-name">{`Node ${item.id}`}</span>
            <span className="item-util">{utilPercent}%</span>
          </div>
          
          <div className="item-bar">
            <div className="bar-fill" style={{ width: `${barFill}%` }}></div>
          </div>
          
          <div className="item-details">
            <span>Current: {item.flow.toFixed(2)} / {item.capacity.toFixed(2)} units</span>
            {item.isNearSat && <span>Headroom: {headroom} units</span>}
          </div>
        </div>
      );
    } else {
      const [src, dst] = item.edge;
      return (
        <div key={`edge-${src}-${dst}`} className={`component-item ${item.isNearSat ? 'near-sat' : 'saturated'}`}>
          <div className="item-header">
            <span className="item-icon">{item.isNearSat ? '🟠' : '🔴'}</span>
            <span className="item-name">{`Edge (${src},${dst})`}</span>
            <span className="item-util">{utilPercent}%</span>
          </div>
          
          <div className="item-bar">
            <div className="bar-fill" style={{ width: `${barFill}%` }}></div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="components-list">
      <h3>🔴 Saturated Components (100%)</h3>
      <div className="items-container">
        {saturatedItems.filter(i => !i.isNearSat).map(renderItem)}
      </div>
      
      <h3 style={{ marginTop: '20px' }}>🟠 Near-Saturated Components (90-99%)</h3>
      <div className="items-container">
        {saturatedItems.filter(i => i.isNearSat).map(renderItem)}
      </div>
    </div>
  );
};

export default SaturatedComponentsList;
```

### CSS
```css
.components-list h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 16px 0 12px 0;
  color: #1f2937;
}

.components-list h3:first-child {
  margin-top: 0;
}

.items-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.component-item {
  padding: 12px;
  border-left: 4px solid;
  border-radius: 4px;
  background: #fff;
}

.component-item.saturated {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.component-item.near-sat {
  border-left-color: #f97316;
  background: #fff7ed;
}

.item-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}

.item-icon {
  font-size: 18px;
}

.item-name {
  font-weight: 600;
  color: #1f2937;
  flex: 1;
}

.item-util {
  font-weight: 700;
  color: #dc2626;
  min-width: 50px;
  text-align: right;
}

.item-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.item-bar .bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #fbbf24, #dc2626);
}

.item-details {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #6b7280;
}
```

---

## Component 4: Upgrade Priorities Table

### Visual Mock-up
```
UPGRADE RECOMMENDATIONS
────────────────────────────────────────────────────────
Rank │ Component      │ Priority │ Impact   │ Action
─────┼────────────────┼──────────┼──────────┼─────────
1 🔴 │ Node 11        │ ████████ 98% │ +3.2 units│ Upgrade
2 🟠 │ (11,19)        │ ███████░ 92% │ +2.1 units│ Upgrade  
3 🟡 │ (11,21)        │ ██████░░ 88% │ +1.8 units│ Decide
```

### React Implementation
```jsx
const UpgradePrioritiesTable = ({ response }) => {
  const upgrades = response.upgrade_analysis || {};
  const nodePriorities = upgrades.node_priorities || [];
  const edgePriorities = upgrades.edge_priorities || [];
  
  // Combine and sort all by priority_score
  const allPriorities = [
    ...nodePriorities.map(p => ({ ...p, component: `Node ${p.node}`, type: 'node' })),
    ...edgePriorities.map(p => ({ ...p, component: `Edge (${p.edge[0]},${p.edge[1]})`, type: 'edge' }))
  ].sort((a, b) => b.priority_score - a.priority_score);

  const getRankBadge = (index) => {
    if (index === 0) return '1 🔴';
    if (index === 1) return '2 🟠';
    if (index === 2) return '3 🟡';
    return `${index + 1} 🟤`;
  };

  const getPriorityColor = (score) => {
    if (score >= 0.9) return '#dc2626'; // Red
    if (score >= 0.75) return '#f97316'; // Orange
    if (score >= 0.5) return '#eab308'; // Yellow
    return '#6b7280'; // Gray
  };

  return (
    <div className="upgrades-table-container">
      <h3>💡 Upgrade Recommendations</h3>
      
      <table className="upgrades-table">
        <thead>
          <tr>
            <th>Rank</th>
            <th>Component</th>
            <th>Priority Score</th>
            <th>Expected Impact</th>
            <th>Marginal Value</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {allPriorities.map((item, index) => (
            <tr key={`${item.type}-${item.component}`} className={`priority-${index}`}>
              <td className="rank">{getRankBadge(index)}</td>
              <td className="component">{item.component}</td>
              <td className="priority">
                <div className="priority-bar">
                  <div 
                    className="priority-fill"
                    style={{ 
                      width: `${item.priority_score * 100}%`,
                      backgroundColor: getPriorityColor(item.priority_score)
                    }}
                  ></div>
                </div>
                <span className="priority-value">{(item.priority_score * 100).toFixed(0)}%</span>
              </td>
              <td className="impact">
                <strong>+{item.expected_flow_increase.toFixed(2)} units</strong>
              </td>
              <td className="marginal-value">
                <span className="mv-badge">{item.marginal_value.toFixed(2)}</span>
                <span className="mv-label">per unit</span>
              </td>
              <td className="action">
                <button className="btn-upgrade">Upgrade</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="table-notes">
        <p><strong>Marginal Value:</strong> Flow increase per unit of capacity upgrade</p>
        <p><strong>Priority Score:</strong> Combination of current utilization and expected impact</p>
      </div>
    </div>
  );
};

export default UpgradePrioritiesTable;
```

### CSS
```css
.upgrades-table-container {
  margin: 20px 0;
}

.upgrades-table-container h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  color: #1f2937;
}

.upgrades-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05);
}

.upgrades-table thead {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
}

.upgrades-table th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  font-size: 13px;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.upgrades-table tbody tr {
  border-bottom: 1px solid #e5e7eb;
  transition: background 0.2s;
}

.upgrades-table tbody tr:hover {
  background: #f9fafb;
}

.upgrades-table tbody tr:last-child {
  border-bottom: none;
}

.upgrades-table td {
  padding: 12px;
  font-size: 13px;
  color: #374151;
}

.upgrades-table .rank {
  font-weight: 700;
  min-width: 60px;
}

.upgrades-table .component {
  font-weight: 600;
  color: #1f2937;
}

.upgrades-table .priority {
  min-width: 120px;
}

.priority-bar {
  height: 6px;
  background: #e5e7eb;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.priority-fill {
  height: 100%;
  transition: width 0.3s ease;
}

.priority-value {
  font-weight: 600;
  color: #1f2937;
  font-size: 12px;
}

.upgrades-table .impact {
  color: #059669;
  font-weight: 600;
}

.marginal-value {
  text-align: center;
}

.mv-badge {
  display: block;
  background: #ecfdf5;
  padding: 2px 8px;
  border-radius: 3px;
  font-weight: 600;
  color: #059669;
  font-size: 12px;
}

.mv-label {
  display: block;
  font-size: 11px;
  color: #6b7280;
  margin-top: 2px;
}

.upgrades-table .action {
  text-align: center;
}

.btn-upgrade {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.2s;
}

.btn-upgrade:hover {
  background: #2563eb;
}

.table-notes {
  margin-top: 12px;
  padding: 12px;
  background: #f0fdf4;
  border-left: 3px solid #22c55e;
  border-radius: 4px;
  font-size: 12px;
  color: #166534;
}

.table-notes p {
  margin: 4px 0;
}

.table-notes strong {
  color: #15803d;
}
```

---

## Component 5: Utilization Heatmap

### Visual Mock-up
```
UTILIZATION HEATMAP
───────────────────────────────────
Nodes:              Edges:

1  2  3  4  5       (1,9)  (1,11) (2,10)
🟢 🟢 🟢 🟢 🟢       🟢     🟢     🟢

9  10 11 12 13      (11,19)(11,21)(11,22)
🟢 🟡 🔴 🟡 🟡       🔴     🟠     🟠

14 15 16...
```

### React Implementation
```jsx
const UtilizationHeatmap = ({ response }) => {
  const bottleneck = response.bottlenecks || {};
  const utilByComp = bottleneck.utilization_by_component || {};
  const nodeFlows = response.node_flows || {};
  
  // Helper to get color for utilization
  const getUtilColor = (utilization) => {
    if (utilization >= 0.95) return { color: '#dc2626', label: '🔴', class: 'red' };
    if (utilization >= 0.85) return { color: '#f97316', label: '🟠', class: 'orange' };
    if (utilization >= 0.70) return { color: '#eab308', label: '🟡', class: 'yellow' };
    return { color: '#22c55e', label: '🟢', class: 'green' };
  };
  
  // Group components for display
  const nodeIds = Object.keys(nodeFlows).sort((a,b) => a-b);
  const edgeIds = Object.keys(utilByComp)
    .filter(k => !nodeIds.includes(k))
    .sort();
  
  const renderHeatmapGrid = (componentIds, title) => {
    const cellsPerRow = 6;
    const gridItems = componentIds.map(id => {
      const util = utilByComp[id] || 0;
      const utilPercent = (util * 100).toFixed(0);
      const colorInfo = getUtilColor(util);
      
      return (
        <div
          key={id}
          className={`heatmap-cell util-${colorInfo.class}`}
          title={`${id}: ${utilPercent}%`}
          style={{ backgroundColor: colorInfo.color }}
        >
          <span className="cell-label">{id}</span>
          <span className="cell-percent">{utilPercent}%</span>
        </div>
      );
    });
    
    return (
      <div className="heatmap-section">
        <h4>{title}</h4>
        <div className="heatmap-grid" style={{ 
          gridTemplateColumns: `repeat(${cellsPerRow}, 1fr)` 
        }}>
          {gridItems}
        </div>
      </div>
    );
  };

  return (
    <div className="heatmap-container">
      <h3>Utilization Heatmap</h3>
      
      {renderHeatmapGrid(nodeIds, "Nodes")}
      {renderHeatmapGrid(edgeIds, "Edges")}
      
      <div className="heatmap-legend">
        <h4>Legend</h4>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-box green"></span>
            <span>0-70% (Healthy)</span>
          </div>
          <div className="legend-item">
            <span className="legend-box yellow"></span>
            <span>70-85% (Moderate)</span>
          </div>
          <div className="legend-item">
            <span className="legend-box orange"></span>
            <span>85-95% (High)</span>
          </div>
          <div className="legend-item">
            <span className="legend-box red"></span>
            <span>95-100% (Critical)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UtilizationHeatmap;
```

### CSS
```css
.heatmap-container {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  margin: 20px 0;
}

.heatmap-container h3 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.heatmap-section {
  margin-bottom: 24px;
}

.heatmap-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.heatmap-grid {
  display: grid;
  gap: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.heatmap-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
  color: white;
  font-weight: 600;
  font-size: 12px;
  position: relative;
}

.heatmap-cell:hover {
  transform: scale(1.1);
  box-shadow: 0 0 12px rgba(0,0,0,0.2);
  z-index: 10;
}

.cell-label {
  font-weight: 700;
  font-size: 13px;
}

.cell-percent {
  font-size: 11px;
  opacity: 0.9;
}

.heatmap-cell.util-green {
  background: #22c55e;
}

.heatmap-cell.util-yellow {
  background: #eab308;
  color: #111;
}

.heatmap-cell.util-orange {
  background: #f97316;
}

.heatmap-cell.util-red {
  background: #dc2626;
}

.heatmap-legend {
  margin-top: 16px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
}

.heatmap-legend h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.legend-items {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-box {
  width: 20px;
  height: 20px;
  border-radius: 3px;
}

.legend-box.green { background: #22c55e; }
.legend-box.yellow { background: #eab308; }
.legend-box.orange { background: #f97316; }
.legend-box.red { background: #dc2626; }
```

---

## Component 6: SPOF Alert

### Visual Mock-up
```
┌───────────────────────────────────────────┐
│ ⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️⚠️ │
│ CRITICAL VULNERABILITY DETECTED          │
│                                           │
│ Node 11 is a SINGLE POINT OF FAILURE     │
│                                           │
│ • All network flow passes through it     │
│ • If it fails: 0% throughput (100% loss) │
│ • No alternative paths available         │
│ • No backup or redundancy                │
│                                           │
│ ACTION REQUIRED                           │
│ ─────────────────────────────────────── │
│ 1. Add parallel processing node          │
│ 2. Create redundant path                 │
│ 3. Implement load balancing              │
│                                           │
│ Expected improvement: +25.5 units        │
│                                           │
└───────────────────────────────────────────┘
```

### React Implementation
```jsx
const SPOFAlert = ({ response }) => {
  const criticalPaths = response.critical_paths || {};
  const spofs = criticalPaths.single_points_of_failure || [];
  
  if (!spofs || spofs.length === 0) {
    return (
      <div className="spof-alert safe">
        <h3>✅ Network Resilience</h3>
        <p>No critical single points of failure detected.</p>
        <p>Network has adequate redundancy and path diversity.</p>
      </div>
    );
  }
  
  // Calculate impact
  const maxFlow = response.total_max_flow || 0;

  return (
    <div className="spof-alert critical">
      <div className="spof-header">
        <span className="spof-icon">⚠️⚠️⚠️</span>
        <h3>CRITICAL VULNERABILITY DETECTED</h3>
      </div>
      
      <div className="spof-content">
        <div className="spof-list">
          {spofs.map((nodeId, index) => (
            <div key={nodeId} className="spof-item">
              <h4>🔴 CRITICAL: Node {nodeId}</h4>
              
              <div className="spof-metrics">
                <div className="metric">
                  <span className="metric-label">All Network Flow:</span>
                  <span className="metric-value">100% passes through</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Failure Impact:</span>
                  <span className="metric-value">100% network disconnection</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Alternative Paths:</span>
                  <span className="metric-value">NONE (0)</span>
                </div>
                <div className="metric">
                  <span className="metric-label">Backup Available:</span>
                  <span className="metric-value">NO redundancy</span>
                </div>
              </div>
              
              {index < spofs.length - 1 && <hr className="spof-divider" />}
            </div>
          ))}
        </div>
        
        <div className="spof-actions">
          <h4>💡 SUGGESTED REMEDIATION</h4>
          <ol>
            <li>Add parallel processing node to distribute load</li>
            <li>Create redundant transmission paths</li>
            <li>Implement automatic failover mechanism</li>
            <li>Add load balancing across parallel paths</li>
          </ol>
          <div className="expected-benefit">
            <strong>Expected Improvement:</strong> {`+${(maxFlow * 0.5).toFixed(2)} units`}
            <br />
            <small>(50% throughput increase with redundancy)</small>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SPOFAlert;
```

### CSS
```css
.spof-alert {
  border-left: 5px solid;
  border-radius: 6px;
  padding: 16px;
  margin: 20px 0;
  background: #fff;
}

.spof-alert.safe {
  border-left-color: #22c55e;
  background: #f0fdf4;
}

.spof-alert.safe h3 {
  color: #15803d;
  margin: 0 0 8px 0;
}

.spof-alert.safe p {
  color: #166534;
  margin: 4px 0;
}

.spof-alert.critical {
  border-left-color: #dc2626;
  background: #fef2f2;
}

.spof-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.spof-icon {
  font-size: 24px;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.spof-header h3 {
  margin: 0;
  color: #dc2626;
  font-size: 18px;
  font-weight: 700;
}

.spof-content {
  background: white;
  border: 1px solid #fee2e2;
  border-radius: 4px;
  padding: 12px;
}

.spof-list {
  margin-bottom: 16px;
}

.spof-item {
  margin-bottom: 12px;
}

.spof-item h4 {
  margin: 0 0 10px 0;
  color: #dc2626;
  font-size: 15px;
  font-weight: 700;
}

.spof-metrics {
  display: grid;
  gap: 8px;
  margin-left: 16px;
  font-size: 13px;
}

.metric {
  display: flex;
  justify-content: space-between;
  padding: 6px;
  background: #fef2f2;
  border-radius: 3px;
}

.metric-label {
  color: #6b7280;
  font-weight: 500;
}

.metric-value {
  color: #dc2626;
  font-weight: 600;
}

.spof-divider {
  border: none;
  border-top: 1px solid #fee2e2;
  margin: 12px 0;
}

.spof-actions {
  background: #fef2f2;
  padding: 12px;
  border-radius: 4px;
}

.spof-actions h4 {
  margin: 0 0 10px 0;
  color: #dc2626;
  font-size: 14px;
  font-weight: 600;
}

.spof-actions ol {
  margin: 0;
  padding-left: 20px;
  color: #6b7280;
  font-size: 13px;
}

.spof-actions li {
  margin-bottom: 6px;
  line-height: 1.4;
}

.expected-benefit {
  margin-top: 12px;
  padding: 10px;
  background: white;
  border-left: 3px solid #059669;
  border-radius: 3px;
  font-size: 13px;
  color: #166534;
}

.expected-benefit strong {
  color: #15803d;
}

.expected-benefit small {
  display: block;
  margin-top: 4px;
  opacity: 0.8;
}
```

---

## Component 7: Interval Uncertainty Widget

### Visual Mock-up
```
NETWORK THROUGHPUT UNDER UNCERTAINTY
──────────────────────────────────────

Worst Case    Expected    Best Case
    ↓           ↓            ↓
[───────────═════────────────────]
19.4          21.0          22.6
units         units         units

Uncertainty Band: ±1.6 units
Confidence: 95% within range
```

### React Implementation
```jsx
const IntervalUncertaintyWidget = ({ response }) => {
  const minFlow = response.guaranteed_min_flow || 0;
  const maxFlow = response.possible_max_flow || 0;
  const expectedFlow = response.expected_flow || (minFlow + maxFlow) / 2;
  
  const range = maxFlow - minFlow;
  const minPercent = 5;  // Left margin %
  const maxPercent = 95; // Right margin %
  const minPos = minPercent + ((expectedFlow - minFlow) / range) * (maxPercent - minPercent);
  const maxPos = minPercent + ((maxFlow - minFlow) / range) * (maxPercent - minPercent);
  const expectedPos = minPercent + ((expectedFlow - minFlow) / range) * (maxPercent - minPercent);
  
  return (
    <div className="interval-widget">
      <h3>Network Throughput Under Uncertainty</h3>
      
      <div className="interval-labels">
        <span>Worst Case</span>
        <span>Expected</span>
        <span>Best Case</span>
      </div>
      
      <div className="interval-container">
        {/* Track */}
        <div className="interval-track">
          <div 
            className="interval-zone worst"
            style={{ 
              left: `${minPercent}%`,
              width: `${(expectedPos - minPercent) * 0.5}%`
            }}
          ></div>
          <div 
            className="interval-zone best"
            style={{ 
              left: `${(minPercent + expectedPos) / 2}%`,
              width: `${(maxPercent - expectedPos) * 0.5}%`
            }}
          ></div>
        </div>
        
        {/* Markers */}
        <div 
          className="interval-marker min"
          style={{ left: `${minPercent}%` }}
          title={`Worst: ${minFlow} units`}
        >
          <span className="marker-label">{minFlow.toFixed(1)}</span>
        </div>
        <div 
          className="interval-marker expected"
          style={{ left: `${expectedPos}%` }}
          title={`Expected: ${expectedFlow} units`}
        >
          <span className="marker-label">{expectedFlow.toFixed(1)}</span>
        </div>
        <div 
          className="interval-marker max"
          style={{ left: `${maxPercent}%` }}
          title={`Best: ${maxFlow} units`}
        >
          <span className="marker-label">{maxFlow.toFixed(1)}</span>
        </div>
      </div>
      
      <div className="interval-info">
        <div className="info-item">
          <strong>Guaranteed (Worst Case):</strong>
          <span>{minFlow.toFixed(1)} units</span>
          <span className="description">Even if all conditions are unfavorable</span>
        </div>
        <div className="info-item">
          <strong>Expected (Average):</strong>
          <span>{expectedFlow.toFixed(1)} units</span>
          <span className="description">Most likely outcome</span>
        </div>
        <div className="info-item">
          <strong>Possible (Best Case):</strong>
          <span>{maxFlow.toFixed(1)} units</span>
          <span className="description">If conditions are favorable</span>
        </div>
        <div className="info-item">
          <strong>Uncertainty Band:</strong>
          <span>±{(range / 2).toFixed(1)} units</span>
          <span className="description">Range of possible outcomes</span>
        </div>
      </div>
      
      <div className="interval-recommendation">
        <h4>📊 Decision Support</h4>
        <p>
          For <strong>conservative operations</strong>: Plan for <strong>{minFlow.toFixed(1)} units</strong> guaranteed throughput.
        </p>
        <p>
          If conditions improve, you gain headroom up to <strong>{maxFlow.toFixed(1)} units</strong>, 
          a potential <strong>+{(maxFlow - minFlow).toFixed(1)} units</strong> improvement.
        </p>
        <p className="design-safe">
          ✅ <strong>Design is ROBUST:</strong> Can operate safely even in worst-case scenarios.
        </p>
      </div>
    </div>
  );
};

export default IntervalUncertaintyWidget;
```

### CSS
```css
.interval-widget {
  padding: 16px;
  background: #fff;
  border-radius: 8px;
  border: 2px solid #0284c7;
  margin: 20px 0;
}

.interval-widget h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.interval-labels {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.interval-container {
  position: relative;
  height: 80px;
  margin-bottom: 12px;
  padding: 0 10px;
}

.interval-track {
  position: absolute;
  left: 10px;
  right: 10px;
  top: 25px;
  height: 20px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.interval-zone {
  position: absolute;
  height: 100%;
  top: 0;
}

.interval-zone.worst {
  background: linear-gradient(90deg, #dc2626, #f97316);
  opacity: 0.3;
}

.interval-zone.best {
  background: linear-gradient(90deg, #f97316, #22c55e);
  opacity: 0.3;
}

.interval-marker {
  position: absolute;
  top: 0;
  transform: translateX(-50%);
  text-align: center;
}

.marker-label {
  position: relative;
  top: -25px;
  display: block;
  font-weight: 700;
  font-size: 13px;
  color: #1f2937;
}

.interval-marker.min::after,
.interval-marker.expected::after,
.interval-marker.max::after {
  content: '';
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
}

.interval-marker.min::after {
  background: #dc2626;
  box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.2);
}

.interval-marker.expected::after {
  background: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.2);
  width: 14px;
  height: 14px;
  top: 19px;
}

.interval-marker.max::after {
  background: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
}

.interval-marker::before {
  content: '';
  position: absolute;
  width: 2px;
  height: 36px;
  background: currentColor;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  opacity: 0.3;
}

.interval-marker.min::before { color: #dc2626; }
.interval-marker.expected::before { color: #0284c7; }
.interval-marker.max::before { color: #22c55e; }

.interval-info {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin: 20px 0;
}

.info-item {
  padding: 12px;
  background: #f0f9ff;
  border-left: 3px solid #0284c7;
  border-radius: 4px;
}

.info-item strong {
  display: block;
  font-size: 12px;
  color: #0284c7;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.info-item span:first-of-type {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
  margin-bottom: 4px;
}

.info-item .description {
  display: block;
  font-size: 11px;
  color: #6b7280;
  font-weight: normal;
  margin-top: 4px !important;
}

.interval-recommendation {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 6px;
  padding: 12px;
  margin-top: 16px;
}

.interval-recommendation h4 {
  margin: 0 0 8px 0;
  color: #0284c7;
  font-size: 13px;
  font-weight: 600;
}

.interval-recommendation p {
  margin: 8px 0;
  font-size: 13px;
  color: #1e40af;
  line-height: 1.5;
}

.interval-recommendation strong {
  color: #1e40af;
  font-weight: 700;
}

.interval-recommendation .design-safe {
  background: #ecfdf5;
  border-left: 3px solid #10b981;
  padding: 8px;
  margin-top: 12px;
  color: #047857;
  font-weight: 600;
}
```

---

## Global Styles & Theme

```css
:root {
  --color-primary: #3b82f6;
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-danger: #ef4444;
  --color-info: #0284c7;
  
  --text-primary: #1f2937;
  --text-secondary: #6b7280;
  --bg-light: #f9fafb;
  --bg-lighter: #f3f4f6;
  --border-color: #e5e7eb;
  
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
  
  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  color: var(--text-primary);
  background: #fff;
  line-height: 1.6;
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  font-weight: 600;
}

button {
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
  
  .interval-info {
    grid-template-columns: 1fr !important;
  }
  
  .legend-items {
    grid-template-columns: 1fr 1fr !important;
  }
}

/* Utility classes */
.text-center { text-align: center; }
.text-right { text-align: right; }
.mt-20 { margin-top: 20px; }
.mb-20 { margin-bottom: 20px; }
.p-16 { padding: 16px; }
.gap-12 { gap: 12px; }
```

---

##Summary

These components provide:
- ✅ Complete visual hierarchy
- ✅ Color-blind accessible design
- ✅ Responsive mobile/desktop layouts
- ✅ Accessible HTML semantics
- ✅ Interactive hover/focus states
- ✅ Animated alerts (SPOF)
- ✅ Real data integration points

Connect these to your backend response JSON and filter/display as needed per user workflow.

