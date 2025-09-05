import { Injectable, signal, computed } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { map, switchMap, catchError } from 'rxjs/operators';
import {
  UploadedFile,
  CategorizedFile,
  AnalysisType,
  DataType,
  FileManagerState,
  FileCategorization,
  FileValidationRule,
  ReachabilityFileGroup,
  CapacityFileGroup,
  CpmFileGroup,
  NetworkFileGroup,
  AnalysisFileGroup
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class FileManagerService {
  
  // File categorization patterns
  private readonly categorization: FileCategorization = {
    patterns: {
      edges: [/\.edges$/i, /edge.*\.txt$/i, /network.*\.txt$/i],
      nodepriors: [/nodepriors?.*\.json$/i, /node[-_]priors?.*\.json$/i, /priors?.*\.json$/i],
      linkprobs: [/linkprob.*\.json$/i, /link[-_]prob.*\.json$/i, /edge[-_]prob.*\.json$/i, /probabilities.*\.json$/i],
      capacities: [/capacit.*\.json$/i, /capacity.*\.json$/i, /flow.*\.json$/i],
      cpm: [/cpm.*\.json$/i, /cmp.*\.json$/i, /time.*\.json$/i, /cost.*\.json$/i, /critical.*\.json$/i],
      mapping: [/mapping.*\.txt$/i, /node[-_]map.*\.txt$/i, /labels.*\.txt$/i, /names.*\.txt$/i]
    },
    folderPatterns: {
      float: [/^(float|crisp|deterministic)$/i],
      interval: [/^(interval|range)$/i],
      pbox: [/^(pbox|p-box|probability[-_]?box)$/i],
      capacity: [/^(capacity|capacities|flow)$/i],
      cpm: [/^(cpm|cmp|critical|time|cost)$/i]
    }
  };

  // Validation rules for different analysis types
  private readonly validationRules: FileValidationRule[] = [
    {
      analysisType: 'reachability',
      requiredFiles: ['nodepriors', 'linkprobs'],
      optionalFiles: ['edges'],
      fileExtensions: ['.json'],
      contentValidation: this.validateReachabilityContent
    },
    {
      analysisType: 'capacity',
      requiredFiles: ['capacities', 'edges'],
      optionalFiles: [],
      fileExtensions: ['.json', '.edges'],
      contentValidation: this.validateCapacityContent
    },
    {
      analysisType: 'cpm',
      requiredFiles: ['cpm', 'edges'],
      optionalFiles: [],
      fileExtensions: ['.json', '.edges'],
      contentValidation: this.validateCpmContent
    },
    {
      analysisType: 'network',
      requiredFiles: ['edges'],
      optionalFiles: ['mapping'],
      fileExtensions: ['.edges', '.txt']
    }
  ];

  // State management
  private fileManagerStateSignal = signal<FileManagerState>({
    uploadedFiles: [],
    analysisGroups: {
      reachability: [],
      capacity: [],
      cpm: [],
      network: {
        analysisType: 'network',
        files: [],
        isComplete: false,
        missingFiles: [],
        canRunAnalysis: false
      }
    },
    selectedNetworkPath: null,
    isUploading: false,
    uploadProgress: 0,
    validationResults: {
      errors: [],
      warnings: [],
      suggestions: []
    }
  });

  // Computed properties
  readonly fileManagerState = computed(() => this.fileManagerStateSignal());
  readonly uploadedFiles = computed(() => this.fileManagerStateSignal().uploadedFiles);
  readonly analysisGroups = computed(() => this.fileManagerStateSignal().analysisGroups);
  readonly isUploading = computed(() => this.fileManagerStateSignal().isUploading);
  readonly validationResults = computed(() => this.fileManagerStateSignal().validationResults);

  /**
   * Process uploaded files and categorize them intelligently
   */
  processUploadedFiles(files: FileList): Observable<CategorizedFile[]> {
    this.setUploading(true);
    
    const fileArray = Array.from(files);
    const processPromises = fileArray.map(file => this.processFile(file));

    return from(Promise.all(processPromises)).pipe(
      map(categorizedFiles => {
        this.updateUploadedFiles(categorizedFiles);
        this.organizeIntoAnalysisGroups(categorizedFiles);
        this.validateAnalysisGroups();
        this.setUploading(false);
        return categorizedFiles;
      }),
      catchError(error => {
        console.error('Error processing uploaded files:', error);
        this.setUploading(false);
        return of([]);
      })
    );
  }

  /**
   * Process a single file and categorize it
   */
  private async processFile(file: File): Promise<CategorizedFile> {
    const uploadedFile: UploadedFile = {
      id: this.generateFileId(),
      name: file.name,
      path: this.getFilePath(file),
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    };

    // Read content for small files (< 1MB) for validation
    if (file.size < 1024 * 1024) {
      try {
        uploadedFile.content = await this.readFileContent(file);
      } catch (error) {
        console.warn('Could not read file content:', error);
      }
    }

    return this.categorizeFile(uploadedFile);
  }

  /**
   * Intelligently categorize a file based on name, path, and content
   */
  private categorizeFile(file: UploadedFile): CategorizedFile {
    const fileName = file.name.toLowerCase();
    const filePath = file.path.toLowerCase();
    const pathParts = filePath.split('/');
    
    let analysisType: AnalysisType = 'unknown';
    let dataType: DataType = 'float';
    let confidence = 0;
    let suggestedRole = 'Unknown File';
    let validationErrors: string[] = [];
    let validationWarnings: string[] = [];

    // 1. Check file patterns
    for (const [type, patterns] of Object.entries(this.categorization.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(fileName)) {
          confidence = Math.max(confidence, 0.8);
          suggestedRole = this.getRoleFromType(type);
          
          if (type === 'edges') {
            analysisType = 'network';
            dataType = 'edges';
          } else if (type === 'nodepriors' || type === 'linkprobs') {
            analysisType = 'reachability';
            suggestedRole = type === 'nodepriors' ? 'Node Priors' : 'Link Probabilities';
          } else if (type === 'capacities') {
            analysisType = 'capacity';
            dataType = 'capacity';
          } else if (type === 'cpm') {
            analysisType = 'cpm';
            dataType = 'cpm';
          } else if (type === 'mapping') {
            analysisType = 'network';
            dataType = 'mapping';
          }
          break;
        }
      }
    }

    // 2. Check folder structure for data type
    if (pathParts.length > 1) {
      const parentFolder = pathParts[pathParts.length - 2];
      for (const [type, patterns] of Object.entries(this.categorization.folderPatterns)) {
        for (const pattern of patterns) {
          if (pattern.test(parentFolder)) {
            if (type === 'float' || type === 'interval' || type === 'pbox') {
              dataType = type as DataType;
              if (analysisType === 'unknown') {
                analysisType = 'reachability';
              }
            } else {
              dataType = type as DataType;
              analysisType = type as AnalysisType;
            }
            confidence = Math.max(confidence, 0.9);
            break;
          }
        }
      }
    }

    // 3. Content-based validation if available
    if (file.content && confidence > 0) {
      const contentValidation = this.validateFileContent(file.content, analysisType);
      validationErrors = contentValidation.errors;
      validationWarnings = contentValidation.warnings;
      if (contentValidation.isValid) {
        confidence = Math.max(confidence, 0.95);
      }
    }

    // 4. Network path detection
    const networkPath = this.extractNetworkPath(file.path);

    return {
      ...file,
      analysisType,
      dataType,
      confidence,
      suggestedRole,
      isUserAssigned: false,
      validationErrors,
      validationWarnings
    };
  }

  /**
   * Organize categorized files into analysis groups
   */
  private organizeIntoAnalysisGroups(files: CategorizedFile[]): void {
    const state = this.fileManagerStateSignal();
    const newGroups = { ...state.analysisGroups };

    // Reset groups
    newGroups.reachability = [];
    newGroups.capacity = [];
    newGroups.cpm = [];
    newGroups.network = {
      analysisType: 'network',
      files: [],
      isComplete: false,
      missingFiles: [],
      canRunAnalysis: false
    };

    // Group files by network path and analysis type
    const networkGroups = new Map<string, Map<string, CategorizedFile[]>>();
    const networkPathToFullPath = new Map<string, string>();

    files.forEach(file => {
      const baseNetworkPath = this.extractNetworkPath(file.path);
      const fullNetworkPath = this.extractFullNetworkPath(file.path);
      
      // Store mapping from base path to full path for API calls
      networkPathToFullPath.set(baseNetworkPath, fullNetworkPath);
      
      if (!networkGroups.has(baseNetworkPath)) {
        networkGroups.set(baseNetworkPath, new Map());
      }
      
      const analysisKey = file.analysisType === 'reachability'
        ? `${file.analysisType}-${file.dataType}`
        : file.analysisType;
      
      const analysisGroups = networkGroups.get(baseNetworkPath)!;
      if (!analysisGroups.has(analysisKey)) {
        analysisGroups.set(analysisKey, []);
      }
      
      analysisGroups.get(analysisKey)!.push(file);
    });

    // Create analysis groups
    networkGroups.forEach((analysisGroups, baseNetworkPath) => {
      const fullNetworkPath = networkPathToFullPath.get(baseNetworkPath) || baseNetworkPath;
      // Find the shared edges file for this network path
      const networkFiles = analysisGroups.get('network') || [];
      const sharedEdgesFile = networkFiles.find(f => f.dataType === 'edges') || undefined;
      
      console.log(`🔍 Network path: ${baseNetworkPath}, Full path: ${fullNetworkPath}, Shared edges file:`, sharedEdgesFile?.name);
      
      analysisGroups.forEach((groupFiles, analysisKey) => {
        if (analysisKey.startsWith('reachability')) {
          const dataType = analysisKey.split('-')[1] as DataType;
          const group = this.createReachabilityGroup(fullNetworkPath, groupFiles, dataType, sharedEdgesFile);
          newGroups.reachability.push(group);
        } else if (analysisKey === 'capacity') {
          const group = this.createCapacityGroup(fullNetworkPath, groupFiles, sharedEdgesFile);
          newGroups.capacity.push(group);
        } else if (analysisKey === 'cpm') {
          const group = this.createCpmGroup(fullNetworkPath, groupFiles, sharedEdgesFile);
          newGroups.cpm.push(group);
        } else if (analysisKey === 'network') {
          newGroups.network = this.createNetworkGroup(fullNetworkPath, groupFiles);
        }
      });
    });

    this.fileManagerStateSignal.update(state => ({
      ...state,
      analysisGroups: newGroups
    }));
  }

  /**
   * Reassign a file to a different analysis group
   */
  reassignFile(fileId: string, newAnalysisType: AnalysisType, newDataType?: DataType): void {
    this.fileManagerStateSignal.update(state => {
      const files = state.uploadedFiles.map(file => {
        if (file.id === fileId) {
          return {
            ...file,
            analysisType: newAnalysisType,
            dataType: newDataType || file.dataType,
            isUserAssigned: true,
            confidence: 1.0 // User assignment is 100% confident
          };
        }
        return file;
      });

      return { ...state, uploadedFiles: files };
    });

    // Re-organize groups after reassignment
    this.organizeIntoAnalysisGroups(this.fileManagerStateSignal().uploadedFiles);
    this.validateAnalysisGroups();
  }

  /**
   * Get available analysis groups that can run analysis
   */
  getReadyAnalysisGroups(): AnalysisFileGroup[] {
    const groups = this.analysisGroups();
    const ready: AnalysisFileGroup[] = [];

    groups.reachability.forEach(group => {
      if (group.canRunAnalysis) ready.push(group);
    });

    groups.capacity.forEach(group => {
      if (group.canRunAnalysis) ready.push(group);
    });

    groups.cpm.forEach(group => {
      if (group.canRunAnalysis) ready.push(group);
    });

    if (groups.network.canRunAnalysis) {
      ready.push(groups.network);
    }

    return ready;
  }

  // Helper methods
  private generateFileId(): string {
    return `file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getFilePath(file: File): string {
    return (file as any).webkitRelativePath || file.name;
  }

  private extractNetworkPath(filePath: string): string {
    const parts = filePath.split('/');
    // Return just the base network name so all files (including scenarios) share the same network path
    // This allows scenario folders to share the edges file from the base network
    if (parts.length >= 1) {
      return parts[0]; // Just return "grid-graph" for all files
    } else {
      return 'default-network';
    }
  }

  /**
   * Extract full network path from file path for API calls
   * Returns the full path needed by backend (e.g., 'temp_uploads/uuid/grid-graph')
   */
  private extractFullNetworkPath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length >= 2) {
      // For uploaded files: temp_uploads/uuid/network-name/scenario/file
      // or: temp_uploads/uuid/network-name/file
      // Return: temp_uploads/uuid/network-name
      const pathParts = [];
      for (let i = 0; i < parts.length - 1; i++) {
        pathParts.push(parts[i]);
        // Stop when we reach the network name (not a scenario folder)
        if (i >= 2) break; // temp_uploads/uuid/network-name
      }
      return pathParts.join('/');
    }
    return parts[0]; // Fallback to base name
  }

  private getRoleFromType(type: string): string {
    const roleMap: Record<string, string> = {
      edges: 'Network Edges',
      nodepriors: 'Node Priors',
      linkprobs: 'Link Probabilities',
      capacities: 'Capacities',
      cpm: 'CPM Inputs',
      mapping: 'Node Mapping'
    };
    return roleMap[type] || 'Unknown File';
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private validateFileContent(content: string, analysisType: AnalysisType): { isValid: boolean; errors: string[]; warnings: string[] } {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (content.trim().startsWith('{')) {
        // JSON file validation
        const data = JSON.parse(content);
        
        if (analysisType === 'reachability') {
          if (!data.nodes && !data.links && !data.edges) {
            warnings.push('JSON structure may not match expected reachability format');
          }
        } else if (analysisType === 'capacity') {
          if (!data.capacities) {
            warnings.push('JSON structure may not match expected capacity format');
          }
        } else if (analysisType === 'cpm') {
          if (!data.time_analysis && !data.cost_analysis && !data.cpm_data) {
            warnings.push('JSON structure may not match expected CPM format');
          }
        }
      }
    } catch (error) {
      if (analysisType !== 'network') { // Network files (.edges) are not JSON
        errors.push('Invalid JSON format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private createReachabilityGroup(networkPath: string, files: CategorizedFile[], dataType: DataType, sharedEdgesFile?: CategorizedFile): ReachabilityFileGroup {
    const nodePriorsFile = files.find(f => f.suggestedRole === 'Node Priors');
    const linkProbabilitiesFile = files.find(f => f.suggestedRole === 'Link Probabilities');

    const missingFiles: string[] = [];
    if (!nodePriorsFile) missingFiles.push('Node Priors');
    if (!linkProbabilitiesFile) missingFiles.push('Link Probabilities');

    // Get display name for data type
    const getDataTypeDisplayName = (dt: DataType): string => {
      switch (dt) {
        case 'float': return 'Float (Deterministic)';
        case 'interval': return 'Interval';
        case 'pbox': return 'P-Box';
        default: return dt.charAt(0).toUpperCase() + dt.slice(1);
      }
    };

    return {
      analysisType: 'reachability',
      dataType,
      networkPath,
      edgesFile: sharedEdgesFile,
      nodePriorsFile,
      linkProbabilitiesFile,
      files,
      isComplete: missingFiles.length === 0,
      missingFiles,
      canRunAnalysis: missingFiles.length === 0 && !!sharedEdgesFile
    };
  }

  private createCapacityGroup(networkPath: string, files: CategorizedFile[], sharedEdgesFile?: CategorizedFile): CapacityFileGroup {
    const capacitiesFile = files.find(f => f.dataType === 'capacity');

    const missingFiles: string[] = [];
    if (!capacitiesFile) missingFiles.push('Capacities');

    return {
      analysisType: 'capacity',
      networkPath,
      edgesFile: sharedEdgesFile,
      capacitiesFile,
      files,
      isComplete: missingFiles.length === 0,
      missingFiles,
      canRunAnalysis: missingFiles.length === 0 && !!sharedEdgesFile
    };
  }

  private createCpmGroup(networkPath: string, files: CategorizedFile[], sharedEdgesFile?: CategorizedFile): CpmFileGroup {
    const cpmInputsFile = files.find(f => f.dataType === 'cpm');

    const missingFiles: string[] = [];
    if (!cpmInputsFile) missingFiles.push('CPM Inputs');

    // Check if CPM file has time/cost analysis
    let hasTimeAnalysis = false;
    let hasCostAnalysis = false;
    
    if (cpmInputsFile?.content) {
      try {
        const data = JSON.parse(cpmInputsFile.content);
        hasTimeAnalysis = !!data.time_analysis || !!data.node_durations || !!data.edge_delays;
        hasCostAnalysis = !!data.cost_analysis || !!data.node_costs || !!data.edge_costs;
      } catch (error) {
        // Ignore parsing errors
      }
    }

    return {
      analysisType: 'cpm',
      networkPath,
      edgesFile: sharedEdgesFile,
      cpmInputsFile,
      hasTimeAnalysis,
      hasCostAnalysis,
      files,
      isComplete: missingFiles.length === 0,
      missingFiles,
      canRunAnalysis: missingFiles.length === 0 && !!sharedEdgesFile
    };
  }

  private createNetworkGroup(networkPath: string, files: CategorizedFile[]): NetworkFileGroup {
    const edgesFile = files.find(f => f.dataType === 'edges');
    const nodeMappingFile = files.find(f => f.dataType === 'mapping');

    const missingFiles: string[] = [];
    if (!edgesFile) missingFiles.push('Edges');

    return {
      analysisType: 'network',
      networkPath,
      edgesFile,
      nodeMappingFile,
      files,
      isComplete: missingFiles.length === 0,
      missingFiles,
      canRunAnalysis: missingFiles.length === 0
    };
  }

  private validateAnalysisGroups(): void {
    const groups = this.analysisGroups();
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Validate each group
    groups.reachability.forEach((group, index) => {
      if (!group.isComplete) {
        errors.push(`Reachability group ${index + 1} (${group.dataType}) is missing: ${group.missingFiles.join(', ')}`);
      }
    });

    groups.capacity.forEach((group, index) => {
      if (!group.isComplete) {
        errors.push(`Capacity group ${index + 1} is missing: ${group.missingFiles.join(', ')}`);
      }
    });

    groups.cpm.forEach((group, index) => {
      if (!group.isComplete) {
        errors.push(`CPM group ${index + 1} is missing: ${group.missingFiles.join(', ')}`);
      }
      if (group.isComplete && !group.hasTimeAnalysis && !group.hasCostAnalysis) {
        warnings.push(`CPM group ${index + 1} has no time or cost analysis data`);
      }
    });

    if (!groups.network.isComplete) {
      errors.push(`Network structure is missing: ${groups.network.missingFiles.join(', ')}`);
    }

    // Add suggestions
    if (groups.reachability.length === 0 && groups.capacity.length === 0 && groups.cpm.length === 0) {
      suggestions.push('Upload analysis files in organized folders (float/, interval/, pbox/, capacity/, cpm/)');
    }

    this.fileManagerStateSignal.update(state => ({
      ...state,
      validationResults: { errors, warnings, suggestions }
    }));
  }

  /**
   * Create NetworkStructure from uploaded edges file
   */
  createNetworkStructureFromFiles(): Observable<any> {
    const networkGroup = this.analysisGroups().network;
    
    if (!networkGroup.isComplete || !networkGroup.edgesFile?.content) {
      return of(null);
    }

    try {
      const networkStructure = this.parseEdgesFileToNetworkStructure(
        networkGroup.edgesFile.content,
        networkGroup.nodeMappingFile?.content
      );
      
      // Also create parsed data from all uploaded files
      const parsedData = this.createParsedDataFromFiles();
      
      return of({ networkStructure, parsedData });
    } catch (error) {
      console.error('Error creating network structure from files:', error);
      return of(null);
    }
  }

  /**
   * Parse edges file content to NetworkStructure format
   */
  private parseEdgesFileToNetworkStructure(edgesContent: string, mappingContent?: string): any {
    if (!edgesContent || edgesContent.trim().length === 0) {
      throw new Error('Edges file is empty or invalid');
    }

    const lines = edgesContent.trim().split('\n');
    const edges: [number, number][] = [];
    const nodeSet = new Set<number>();
    const parseErrors: string[] = [];

    // Parse edges
    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) return; // Skip empty lines and comments
      
      // Skip header lines (common headers: source,destination or source target or from to)
      if (index === 0 && /^(source|from|node1|src).*(destination|target|to|node2|dst)/i.test(trimmedLine)) {
        console.log(`🔍 Skipping header line: "${trimmedLine}"`);
        return;
      }
      
      // Support both comma-separated and space-separated formats
      const parts = trimmedLine.includes(',') ?
        trimmedLine.split(',').map(p => p.trim()) :
        trimmedLine.split(/\s+/);
        
      if (parts.length >= 2) {
        const source = parseInt(parts[0]);
        const target = parseInt(parts[1]);
        
        if (!isNaN(source) && !isNaN(target)) {
          edges.push([source, target]);
          nodeSet.add(source);
          nodeSet.add(target);
        } else {
          parseErrors.push(`Line ${index + 1}: Invalid edge format "${trimmedLine}" - non-numeric values`);
        }
      } else if (parts.length === 1 && parts[0].length > 0) {
        parseErrors.push(`Line ${index + 1}: Incomplete edge "${trimmedLine}" - only one column found`);
      }
    });

    if (edges.length === 0) {
      throw new Error(`No valid edges found in file. Parse errors: ${parseErrors.join(', ')}`);
    }

    if (parseErrors.length > 0) {
      console.warn('⚠️ Parse warnings:', parseErrors);
    }

    // Create node mapping if available
    const nodeMapping: { [key: string]: string } = {};
    if (mappingContent) {
      const mappingLines = mappingContent.trim().split('\n');
      mappingLines.forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;
        
        const parts = trimmedLine.split(/\s+/);
        if (parts.length >= 2) {
          const nodeId = parts[0];
          const nodeName = parts.slice(1).join(' ');
          nodeMapping[nodeId] = nodeName;
        }
      });
    }

    // Calculate basic network statistics
    const totalNodes = nodeSet.size;
    const totalEdges = edges.length;
    const nodeConnections = new Map<number, { inDegree: number; outDegree: number }>();

    // Count degrees
    edges.forEach(([source, target]) => {
      if (!nodeConnections.has(source)) {
        nodeConnections.set(source, { inDegree: 0, outDegree: 0 });
      }
      if (!nodeConnections.has(target)) {
        nodeConnections.set(target, { inDegree: 0, outDegree: 0 });
      }
      
      nodeConnections.get(source)!.outDegree++;
      nodeConnections.get(target)!.inDegree++;
    });

    // Calculate average degree
    let totalDegree = 0;
    nodeConnections.forEach(({ inDegree, outDegree }) => {
      totalDegree += inDegree + outDegree;
    });
    const avgDegree = totalNodes > 0 ? totalDegree / totalNodes : 0;

    // Calculate density
    const maxPossibleEdges = totalNodes * (totalNodes - 1);
    const density = maxPossibleEdges > 0 ? (totalEdges * 2) / maxPossibleEdges : 0;

    return {
      edges,
      nodes: Array.from(nodeSet).map(id => ({
        id: id.toString(),
        name: nodeMapping[id.toString()] || id.toString()
      })),
      node_mapping: nodeMapping,
      statistics: {
        total_nodes: totalNodes,
        total_edges: totalEdges,
        average_degree: Math.round(avgDegree * 100) / 100,
        density: Math.round(density * 10000) / 100
      }
    };
  }

  /**
   * Create parsed data structure from all uploaded files
   */
  private createParsedDataFromFiles(): any {
    const groups = this.analysisGroups();
    const parsedData: any = {};

    // Process reachability groups
    groups.reachability.forEach(group => {
      if (group.isComplete) {
        const dataTypeKey = group.dataType;
        
        if (!parsedData[dataTypeKey]) {
          parsedData[dataTypeKey] = {};
        }

        // Parse node priors
        if (group.nodePriorsFile?.content) {
          try {
            const nodePriors = JSON.parse(group.nodePriorsFile.content);
            if (typeof nodePriors === 'object' && nodePriors !== null) {
              parsedData[dataTypeKey].node_priors = nodePriors;
            } else {
              console.warn(`⚠️ Node priors file for ${dataTypeKey} does not contain valid JSON object`);
            }
          } catch (error) {
            console.warn(`❌ Error parsing node priors for ${dataTypeKey}:`, error);
          }
        }

        // Parse link probabilities
        if (group.linkProbabilitiesFile?.content) {
          try {
            const linkProbs = JSON.parse(group.linkProbabilitiesFile.content);
            if (typeof linkProbs === 'object' && linkProbs !== null) {
              parsedData[dataTypeKey].edge_probabilities = linkProbs;
            } else {
              console.warn(`⚠️ Link probabilities file for ${dataTypeKey} does not contain valid JSON object`);
            }
          } catch (error) {
            console.warn(`❌ Error parsing link probabilities for ${dataTypeKey}:`, error);
          }
        }
      }
    });

    // Process capacity groups
    groups.capacity.forEach(group => {
      if (group.isComplete && group.capacitiesFile?.content) {
        try {
          const capacityData = JSON.parse(group.capacitiesFile.content);
          if (typeof capacityData === 'object' && capacityData !== null) {
            parsedData.capacity = {
              capacities: capacityData
            };
          } else {
            console.warn('⚠️ Capacity file does not contain valid JSON object');
          }
        } catch (error) {
          console.warn('❌ Error parsing capacity data:', error);
        }
      }
    });

    // Process CPM groups
    groups.cpm.forEach(group => {
      if (group.isComplete && group.cpmInputsFile?.content) {
        try {
          const cpmData = JSON.parse(group.cpmInputsFile.content);
          if (typeof cpmData === 'object' && cpmData !== null) {
            parsedData.cpm = cpmData;
          } else {
            console.warn('⚠️ CPM file does not contain valid JSON object');
          }
        } catch (error) {
          console.warn('❌ Error parsing CPM data:', error);
        }
      }
    });

    return parsedData;
  }

  private validateReachabilityContent(content: string): { isValid: boolean; errors: string[] } {
    try {
      const data = JSON.parse(content);
      const errors: string[] = [];
      
      if (!data.nodes && !data.links && !data.edges) {
        errors.push('Missing expected properties: nodes, links, or edges');
      }
      
      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: ['Invalid JSON format'] };
    }
  }

  private validateCapacityContent(content: string): { isValid: boolean; errors: string[] } {
    try {
      const data = JSON.parse(content);
      const errors: string[] = [];
      
      if (!data.capacities) {
        errors.push('Missing capacities property');
      }
      
      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: ['Invalid JSON format'] };
    }
  }

  private validateCpmContent(content: string): { isValid: boolean; errors: string[] } {
    try {
      const data = JSON.parse(content);
      const errors: string[] = [];
      
      if (!data.time_analysis && !data.cost_analysis && !data.cpm_data) {
        errors.push('Missing expected CPM properties: time_analysis, cost_analysis, or cmp_data');
      }
      
      return { isValid: errors.length === 0, errors };
    } catch (error) {
      return { isValid: false, errors: ['Invalid JSON format'] };
    }
  }

  private updateUploadedFiles(files: CategorizedFile[]): void {
    this.fileManagerStateSignal.update(state => ({
      ...state,
      uploadedFiles: [...state.uploadedFiles, ...files]
    }));
  }

  private setUploading(isUploading: boolean): void {
    this.fileManagerStateSignal.update(state => ({
      ...state,
      isUploading
    }));
  }

  // Public methods for external access
  clearAllFiles(): void {
    this.fileManagerStateSignal.set({
      uploadedFiles: [],
      analysisGroups: {
        reachability: [],
        capacity: [],
        cpm: [],
        network: {
          analysisType: 'network',
          files: [],
          isComplete: false,
          missingFiles: [],
          canRunAnalysis: false
        }
      },
      selectedNetworkPath: null,
      isUploading: false,
      uploadProgress: 0,
      validationResults: {
        errors: [],
        warnings: [],
        suggestions: []
      }
    });
  }

  removeFile(fileId: string): void {
    this.fileManagerStateSignal.update(state => {
      const files = state.uploadedFiles.filter(f => f.id !== fileId);
      return { ...state, uploadedFiles: files };
    });

    // Re-organize groups after removal
    this.organizeIntoAnalysisGroups(this.fileManagerStateSignal().uploadedFiles);
    this.validateAnalysisGroups();
  }

  getFileById(fileId: string): CategorizedFile | undefined {
    return this.uploadedFiles().find(f => f.id === fileId);
  }

  getFilesForAnalysis(analysisType: AnalysisType, dataType?: DataType): CategorizedFile[] {
    const groups = this.analysisGroups();
    
    if (analysisType === 'reachability') {
      const group = groups.reachability.find(g => g.dataType === dataType);
      return group ? group.files : [];
    } else if (analysisType === 'capacity') {
      const group = groups.capacity[0]; // Assuming single capacity group for now
      return group ? group.files : [];
    } else if (analysisType === 'cpm') {
      const group = groups.cpm[0]; // Assuming single CPM group for now
      return group ? group.files : [];
    } else if (analysisType === 'network') {
      return groups.network.files;
    }
    
    return [];
  }
}