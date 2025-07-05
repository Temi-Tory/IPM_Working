// Models - New comprehensive interfaces
export * from './lib/models/network.models';
export * from './lib/models/api.models';

// Diamond models - explicit exports to avoid conflicts
export {
  DiamondType,
  DiamondAnalysisStatus,
  DiamondEnums
} from './lib/models/diamond.models';
export type {
  DiamondStructure,
  DiamondClassification,
  DiamondDetectionResult,
  DiamondAnalysisConfig,
  DiamondAnalysisProgress,
  DiamondValidationResult,
  DiamondComparisonResult
} from './lib/models/diamond.models';
export type {
  NodeId,
  DiamondPath,
  DiamondPaths,
  DiamondCharacteristic,
  DiamondCharacteristics,
  DiamondMetadata,
  DiamondTypes
} from './lib/models/diamond.models';

// Services
export * from './lib/services/network-state.service';
export * from './lib/services/analysis-state.service';
export * from './lib/services/ui-state.service';
export * from './lib/services/app-state.service';
export * from './lib/services/diamond-state.service';

// Export types from services
export type { AnalysisResults } from './lib/services/analysis-state.service';

// File Handler Service - export service class but not conflicting interfaces
export { FileHandlerService } from './lib/services/file-handler.service';
export type { NetworkFileData, SupportedFileType } from './lib/services/file-handler.service';

// API Service - export the service class but not the interfaces (use new models instead)
export { ApiService } from './lib/services/api.service';

// Re-export the main component
export * from './lib/network-core/network-core';
