// Models - New comprehensive interfaces
export * from './lib/models/network.models';
export * from './lib/models/api.models';

// Services
export * from './lib/services/network-state.service';
export * from './lib/services/analysis-state.service';
export * from './lib/services/ui-state.service';
export * from './lib/services/app-state.service';

// File Handler Service - export service class but not conflicting interfaces
export { FileHandlerService } from './lib/services/file-handler.service';
export type { NetworkFileData, SupportedFileType } from './lib/services/file-handler.service';

// API Service - export the service class but not the interfaces (use new models instead)
export { ApiService } from './lib/services/api.service';

// Re-export the main component
export * from './lib/network-core/network-core';
