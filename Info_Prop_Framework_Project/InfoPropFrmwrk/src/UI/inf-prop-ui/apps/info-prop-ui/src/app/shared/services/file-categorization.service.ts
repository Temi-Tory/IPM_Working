import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';

export interface CategorizedFile {
  file: File;
  relativePath: string;
  category: 'edges' | 'nodepriors' | 'linkprobs' | 'capacities' | 'cpm' | 'unknown';
  scenarioType?: 'float' | 'interval' | 'pbox' | 'capacity' | 'cpm';
  confidence: number;
  networkName?: string;
}

export interface NetworkFolder {
  name: string;
  edgesFile?: CategorizedFile;
  reachabilityScenarios: {
    [scenarioName: string]: {
      nodepriors?: CategorizedFile;
      linkprobs?: CategorizedFile;
    };
  };
  capacityScenarios: {
    [scenarioName: string]: {
      capacities?: CategorizedFile;
    };
  };
  cpmScenarios: {
    [scenarioName: string]: {
      cpm?: CategorizedFile;
    };
  };
  unknownFiles: CategorizedFile[];
}

@Injectable({ providedIn: 'root' })
export class FileCategorizationService {

  private readonly FILE_PATTERNS = {
    edges: /\.edges$/i,
    nodepriors: /(nodepriors?|node-priors?).*\.json$/i,
    linkprobs: /(linkprob|link-prob|linkprobabilit).*\.json$/i,
    capacities: /capacit.*\.json$/i,
    cmp: /(cmp|cpm).*\.json$/i
  };

  private readonly SCENARIO_FOLDER_PATTERNS = {
    float: /^(float|crisp|deterministic)$/i,
    interval: /^(interval|range)$/i,
    pbox: /^(pbox|p-box|probability-box|probabilitybox)$/i,
    capacity: /^(capacity|capacities|flow)$/i,
    cpm: /^(cpm|cmp|critical|time|cost)$/i
  };

  async categorizeUploadedFiles(files: FileList): Promise<NetworkFolder[]> {
    const fileArray = Array.from(files);
    const categorizedFiles = await this.categorizeFiles(fileArray);
    
    return this.organizeIntoNetworkFolders(categorizedFiles);
  }

  async normalizeAndCategorizeFiles(files: FileList): Promise<{ networks: NetworkFolder[], normalizedFiles: File[], pathMap: Map<string, string> }> {
    const fileArray = Array.from(files);
    const categorizedFiles = await this.categorizeFiles(fileArray);
    const networks = this.organizeIntoNetworkFolders(categorizedFiles);
    
    // Create normalized file structure
    const normalizedFiles: File[] = [];
    const pathMap = new Map<string, string>();
    
    for (const network of networks) {
      const networkName = this.sanitizeFileName(network.name);
      
      // Add edges file with normalized path
      if (network.edgesFile) {
        const normalizedPath = `${networkName}/${networkName}.EDGES`;
        const normalizedFile = this.createNormalizedFile(
          network.edgesFile.file,
          normalizedPath
        );
        normalizedFiles.push(normalizedFile);
        pathMap.set(network.edgesFile.relativePath, normalizedPath);
      }
      
      // Add reachability scenario files
      for (const [scenarioName, scenario] of Object.entries(network.reachabilityScenarios)) {
        const scenarioType = this.detectScenarioTypeFromScenario(scenarioName, scenario);
        const folderName = scenarioType || 'float';
        
        if (scenario.nodepriors) {
          const normalizedPath = `${networkName}/${folderName}/${networkName}-nodepriors.json`;
          const relativePath = `${folderName}/${networkName}-nodepriors.json`; // Relative to network dir
          const normalizedFile = this.createNormalizedFile(
            scenario.nodepriors.file,
            normalizedPath
          );
          normalizedFiles.push(normalizedFile);
          pathMap.set(scenario.nodepriors.relativePath, relativePath);
        }
        
        if (scenario.linkprobs) {
          const normalizedPath = `${networkName}/${folderName}/${networkName}-linkprobabilities.json`;
          const relativePath = `${folderName}/${networkName}-linkprobabilities.json`; // Relative to network dir
          const normalizedFile = this.createNormalizedFile(
            scenario.linkprobs.file,
            normalizedPath
          );
          normalizedFiles.push(normalizedFile);
          pathMap.set(scenario.linkprobs.relativePath, relativePath);
        }
      }
      
      // Add capacity scenario files
      for (const [scenarioName, scenario] of Object.entries(network.capacityScenarios)) {
        if (scenario.capacities) {
          const normalizedPath = `${networkName}/capacity/${networkName}-capacities.json`;
          const relativePath = `capacity/${networkName}-capacities.json`; // Relative to network dir
          const normalizedFile = this.createNormalizedFile(
            scenario.capacities.file,
            normalizedPath
          );
          normalizedFiles.push(normalizedFile);
          pathMap.set(scenario.capacities.relativePath, relativePath);
        }
      }
      
      // Add CPM scenario files
      for (const [scenarioName, scenario] of Object.entries(network.cpmScenarios)) {
        if (scenario.cpm) {
          const normalizedPath = `${networkName}/cpm/${networkName}-cpm-inputs.json`;
          const relativePath = `cpm/${networkName}-cpm-inputs.json`; // Relative to network dir
          const normalizedFile = this.createNormalizedFile(
            scenario.cpm.file,
            normalizedPath
          );
          normalizedFiles.push(normalizedFile);
          pathMap.set(scenario.cpm.relativePath, relativePath);
        }
      }
    }
    
    return { networks, normalizedFiles, pathMap };
  }

  private sanitizeFileName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9\-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  private createNormalizedFile(originalFile: File, normalizedPath: string): File {
    // Create a new File object with normalized name but same content
    const normalizedFile = new File([originalFile], normalizedPath, {
      type: originalFile.type,
      lastModified: originalFile.lastModified
    });
    
    // Add webkitRelativePath for folder structure
    Object.defineProperty(normalizedFile, 'webkitRelativePath', {
      value: normalizedPath,
      writable: false
    });
    
    return normalizedFile;
  }

  private detectScenarioTypeFromScenario(scenarioName: string, scenario: any): string {
    // Try to detect from scenario name or file content
    const name = scenarioName.toLowerCase();
    if (name.includes('pbox') || name.includes('p-box')) return 'pbox';
    if (name.includes('interval') || name.includes('range')) return 'interval';
    if (name.includes('float') || name.includes('crisp') || name.includes('deterministic')) return 'float';
    
    // Default to float for reachability scenarios
    return 'float';
  }

  private async categorizeFiles(files: File[]): Promise<CategorizedFile[]> {
    const results: CategorizedFile[] = [];

    for (const file of files) {
      const categorized = await this.categorizeFile(file);
      results.push(categorized);
    }

    return results;
  }

  private async categorizeFile(file: File): Promise<CategorizedFile> {
    const relativePath = this.getRelativePath(file);
    const pathParts = relativePath.split('/');
    const fileName = file.name.toLowerCase();
    
    let category: CategorizedFile['category'] = 'unknown';
    let scenarioType: CategorizedFile['scenarioType'] | undefined;
    let confidence = 0;
    let networkName: string | undefined;

    // Extract network name (usually the root folder or filename prefix)
    networkName = this.extractNetworkName(file.name, relativePath);

    // 1. Check file extension and name patterns
    if (this.FILE_PATTERNS.edges.test(fileName)) {
      category = 'edges';
      confidence = 0.95;
    } else if (this.FILE_PATTERNS.nodepriors.test(fileName)) {
      category = 'nodepriors';
      confidence = 0.9;
    } else if (this.FILE_PATTERNS.linkprobs.test(fileName)) {
      category = 'linkprobs';
      confidence = 0.9;
    } else if (this.FILE_PATTERNS.capacities.test(fileName)) {
      category = 'capacities';
      confidence = 0.9;
    } else if (this.FILE_PATTERNS.cmp.test(fileName)) {
      category = 'cpm';
      confidence = 0.9;
    }

    // 2. Check folder structure for scenario type
    if (pathParts.length > 1) {
      const folderName = pathParts[pathParts.length - 2]; // Parent folder
      scenarioType = this.detectScenarioType(folderName);
      
      if (scenarioType && confidence > 0) {
        confidence = Math.min(0.98, confidence + 0.1); // Boost confidence if folder matches
      }
    }

    // 3. Additional content-based detection for JSON files
    if (fileName.endsWith('.json') && category === 'unknown') {
      try {
        const content = await this.readFileContent(file);
        const contentCategory = this.categorizeByContent(content, fileName);
        if (contentCategory) {
          category = contentCategory.category;
          confidence = contentCategory.confidence;
        }
      } catch (error) {
        console.warn('Could not read file content for categorization:', error);
      }
    }

    return {
      file,
      relativePath,
      category,
      scenarioType,
      confidence,
      networkName
    };
  }

  private getRelativePath(file: File): string {
    // Modern browsers provide webkitRelativePath for folder uploads
    return (file as any).webkitRelativePath || file.name;
  }

  private extractNetworkName(fileName: string, relativePath: string): string {
    // Try to extract network name from path or filename
    const pathParts = relativePath.split('/');
    
    if (pathParts.length > 1) {
      // Use root folder name as network name
      return pathParts[0];
    }
    
    // Fallback: extract from filename (remove extensions and common suffixes)
    return fileName
      .replace(/\.(edges|json)$/i, '')
      .replace(/-?(nodepriors?|linkprob.*|capacit.*|cmp|cpm).*/i, '')
      .trim();
  }

  private detectScenarioType(folderName: string): CategorizedFile['scenarioType'] | undefined {
    for (const [type, pattern] of Object.entries(this.SCENARIO_FOLDER_PATTERNS)) {
      if (pattern.test(folderName)) {
        return type as CategorizedFile['scenarioType'];
      }
    }
    return undefined;
  }

  private async readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private categorizeByContent(content: string, fileName: string): { category: CategorizedFile['category']; confidence: number } | null {
    try {
      const json = JSON.parse(content);
      
      // Check for specific JSON structures
      if (json.nodes && typeof json.nodes === 'object') {
        return { category: 'nodepriors', confidence: 0.85 };
      }
      
      if (json.links && typeof json.links === 'object') {
        return { category: 'linkprobs', confidence: 0.85 };
      }
      
      if (json.capacities && (json.capacities.nodes || json.capacities.edges)) {
        return { category: 'capacities', confidence: 0.85 };
      }
      
      if (json.time_analysis || json.cost_analysis || json.cpm_data) {
        return { category: 'cpm', confidence: 0.85 };
      }
      
      // Check for network_type field
      if (json.network_type === 'capacity_flow') {
        return { category: 'capacities', confidence: 0.9 };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private organizeIntoNetworkFolders(categorizedFiles: CategorizedFile[]): NetworkFolder[] {
    const networkMap = new Map<string, NetworkFolder>();

    for (const file of categorizedFiles) {
      const networkName = file.networkName || 'unknown-network';
      
      if (!networkMap.has(networkName)) {
        networkMap.set(networkName, {
          name: networkName,
          reachabilityScenarios: {},
          capacityScenarios: {},
          cpmScenarios: {},
          unknownFiles: []
        });
      }

      const network = networkMap.get(networkName)!;

      switch (file.category) {
        case 'edges':
          network.edgesFile = file;
          break;

        case 'nodepriors':
          const scenarioName = file.scenarioType || 'default';
          if (!network.reachabilityScenarios[scenarioName]) {
            network.reachabilityScenarios[scenarioName] = {};
          }
          network.reachabilityScenarios[scenarioName].nodepriors = file;
          break;

        case 'linkprobs':
          const linkScenarioName = file.scenarioType || 'default';
          if (!network.reachabilityScenarios[linkScenarioName]) {
            network.reachabilityScenarios[linkScenarioName] = {};
          }
          network.reachabilityScenarios[linkScenarioName].linkprobs = file;
          break;

        case 'capacities':
          const capacityScenarioName = file.scenarioType || 'default';
          if (!network.capacityScenarios[capacityScenarioName]) {
            network.capacityScenarios[capacityScenarioName] = {};
          }
          network.capacityScenarios[capacityScenarioName].capacities = file;
          break;

        case 'cpm':
          const cmpScenarioName = file.scenarioType || 'default';
          if (!network.cpmScenarios[cmpScenarioName]) {
            network.cpmScenarios[cmpScenarioName] = {};
          }
          network.cpmScenarios[cmpScenarioName].cpm = file;
          break;

        default:
          network.unknownFiles.push(file);
          break;
      }
    }

    return Array.from(networkMap.values());
  }

  getRecommendedFolderStructure(): string {
    return `
Recommended folder structure:

your-network-name/
├── your-network-name.EDGES          (required)
├── float/                           (for crisp probabilities)
│   ├── *-nodepriors.json
│   └── *-linkprobabilities.json
├── interval/                        (for interval probabilities)
│   ├── *-nodepriors.json
│   └── *-linkprobabilities.json
├── pbox/                           (for probability box)
│   ├── *-nodepriors.json
│   └── *-linkprobabilities.json
├── capacity/                       (for flow analysis)
│   └── *-capacities.json
└── cpm/                           (for critical path)
    └── *-cpm-inputs.json

Alternative folder names are supported:
- float, crisp, deterministic
- interval, range  
- pbox, p-box, probability-box
- capacity, capacities, flow
- cpm, cmp, critical, time, cost
    `;
  }
}