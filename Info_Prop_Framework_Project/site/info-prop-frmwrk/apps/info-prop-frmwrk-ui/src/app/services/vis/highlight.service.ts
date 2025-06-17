import { Injectable } from '@angular/core';
import { GraphStructure } from '../../shared/models/graph-structure-interface';
import { NodeHighlight } from '../../shared/models/vis/vis-types';
import { VISUALIZATION_CONSTANTS } from '../../shared/models/vis/vis-constants';

@Injectable()
export class HighlightService {

  /**
   * Generate node highlights based on the selected mode
   */
  generateHighlights(structure: GraphStructure, mode: string): NodeHighlight[] {
    if (!structure || mode === 'none') {
      return [];
    }

    const highlights: NodeHighlight[] = [];
    
    try {
      switch (mode) {
        case 'node-types':
          highlights.push(...this.generateNodeTypeHighlights(structure));
          break;
          
        case 'iteration-levels':
          highlights.push(...this.generateIterationLevelHighlights(structure));
          break;
          
        case 'diamond-structures':
          highlights.push(...this.generateDiamondHighlights(structure));
          break;
          
        case 'critical-path':
          highlights.push(...this.generateCriticalPathHighlights(structure));
          break;
      }
    } catch (error) {
      console.warn('Error computing highlights:', error);
    }
    
    return highlights;
  }

  private generateNodeTypeHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    structure.source_nodes?.forEach(nodeId => {
      highlights.push({ 
        nodeId, 
        type: 'source', 
        color: VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.source 
      });
    });
    
    structure.fork_nodes?.forEach(nodeId => {
      highlights.push({ 
        nodeId, 
        type: 'fork', 
        color: VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.fork 
      });
    });
    
    structure.join_nodes?.forEach(nodeId => {
      highlights.push({ 
        nodeId, 
        type: 'join', 
        color: VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.join 
      });
    });
    
    return highlights;
  }

  private generateIterationLevelHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    structure.iteration_sets?.forEach((set, index) => {
      const hue = (index * 60) % 360;
      const color = `hsl(${hue}, 70%, 60%)`;
      
      set.forEach(nodeId => {
        highlights.push({ 
          nodeId, 
          type: 'source', 
          color 
        });
      });
    });
    
    return highlights;
  }

  private generateDiamondHighlights(structure: GraphStructure): NodeHighlight[] {
    const highlights: NodeHighlight[] = [];
    
    if (structure.diamond_structures?.diamondStructures) {
      Object.values(structure.diamond_structures.diamondStructures).forEach(diamond => {
        diamond.diamond?.forEach(group => {
          group.relevant_nodes?.forEach(nodeId => {
            highlights.push({ 
              nodeId, 
              type: 'diamond', 
              color: VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.diamond 
            });
          });
        });
      });
    }
    
    return highlights;
  }

  private generateCriticalPathHighlights(structure: GraphStructure): NodeHighlight[] {
    // This would implement critical path highlighting logic
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get color for a specific node type
   */
  getNodeTypeColor(type: string): string {
    return VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES[type] || VISUALIZATION_CONSTANTS.COLORS.NODE_TYPES.regular;
  }

  /**
   * Check if a highlight mode is valid
   */
  isValidHighlightMode(mode: string): boolean {
    return ['none', 'node-types', 'iteration-levels', 'diamond-structures', 'critical-path'].includes(mode);
  }
}