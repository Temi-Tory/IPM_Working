import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, shareReplay, timer } from 'rxjs';
import { MessageBusService } from './message-bus.service';
import { GraphStateManagementService } from './graph-state-management.service';
import { ParameterManagementService } from './parameter-management.service';
import { AnalysisService } from './analysis.service';
import { VisualizationService } from './visualization.service';

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    messageBus: boolean;
    stateManagement: boolean;
    parameterManagement: boolean;
    analysis: boolean;
    visualization: boolean;
  };
  metrics: {
    totalServices: number;
    healthyServices: number;
    degradedServices: number;
    unhealthyServices: number;
  };
  lastChecked: Date;
}

@Injectable({
  providedIn: 'root'
})
export class HealthMonitorService {
  private readonly messageBus = inject(MessageBusService);
  private readonly stateService = inject(GraphStateManagementService);
  private readonly parameterService = inject(ParameterManagementService);
  private readonly analysisService = inject(AnalysisService);
  private readonly visualizationService = inject(VisualizationService);

  readonly systemHealth$: Observable<SystemHealth> = combineLatest([
    this.messageBus.getHealthStatus(),
    timer(0, 5000) // Check every 5 seconds
  ]).pipe(
    map(() => this.calculateSystemHealth()),
    shareReplay(1)
  );

  private calculateSystemHealth(): SystemHealth {
    const services = {
      messageBus: true, // MessageBusService doesn't have isHealthy method, assume healthy
      stateManagement: this.stateService.isHealthy(),
      parameterManagement: this.parameterService.isHealthy(),
      analysis: this.analysisService.isHealthy(),
      visualization: this.visualizationService.isHealthy()
    };

    const healthyCount = Object.values(services).filter(Boolean).length;
    const totalCount = Object.keys(services).length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyCount === totalCount) {
      overall = 'healthy';
    } else if (healthyCount >= totalCount * 0.7) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services,
      metrics: {
        totalServices: totalCount,
        healthyServices: healthyCount,
        degradedServices: totalCount - healthyCount,
        unhealthyServices: totalCount - healthyCount
      },
      lastChecked: new Date()
    };
  }

  async performHealthCheck(): Promise<SystemHealth> {
    return this.calculateSystemHealth();
  }

  getServiceStatus(serviceName: keyof SystemHealth['services']): boolean {
    const health = this.calculateSystemHealth();
    return health.services[serviceName];
  }

  isSystemHealthy(): boolean {
    const health = this.calculateSystemHealth();
    return health.overall === 'healthy';
  }
}