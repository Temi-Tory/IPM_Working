/**
 * MessageBusService - Central Pub/Sub Communication Hub
 * 
 * Provides type-safe event handling, message batching, and reactive streams
 * for inter-service communication in the GraphStateService refactoring.
 */

import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject, Observable, merge, timer, EMPTY } from 'rxjs';
import { 
  filter, 
  map, 
  debounceTime, 
  throttleTime, 
  buffer, 
  bufferTime, 
  groupBy, 
  mergeMap, 
  takeUntil,
  catchError,
  share,
  distinctUntilChanged
} from 'rxjs/operators';

import { 
  ServiceEvent, 
  ServiceEventType, 
  ServiceEventListener, 
  EventSubscriptionOptions,
  EventPriority,
  SERVICE_EVENT_TYPES
} from '../shared/models/service-events.interface';

import { 
  ServiceOperationResult,
  MessageBatchConfig,
  ServiceMetrics
} from '../shared/models/service-contracts.interface';

/**
 * Event subscription metadata for internal tracking
 */
interface EventSubscription {
  readonly id: string;
  readonly eventType: ServiceEventType | 'ALL';
  readonly listener: ServiceEventListener;
  readonly options: EventSubscriptionOptions;
  readonly subscribedAt: Date;
  readonly callCount: number;
}

/**
 * Message batch for efficient event processing
 */
interface MessageBatch {
  readonly id: string;
  readonly events: ServiceEvent[];
  readonly priority: EventPriority;
  readonly createdAt: Date;
  readonly size: number;
}

/**
 * Service health and performance metrics
 */
interface MessageBusMetrics extends ServiceMetrics {
  readonly totalEventsPublished: number;
  readonly totalEventsDelivered: number;
  readonly activeSubscriptions: number;
  readonly batchesProcessed: number;
  readonly averageBatchSize: number;
  readonly eventTypeCounts: { [eventType: string]: number };
}

@Injectable({
  providedIn: 'root'
})
export class MessageBusService implements OnDestroy {
  private readonly serviceName = 'MessageBusService';
  private readonly version = '1.0.0';

  // Core event streams
  private readonly eventStream$ = new Subject<ServiceEvent>();
  private readonly batchStream$ = new Subject<MessageBatch>();
  private readonly errorStream$ = new Subject<Error>();
  private readonly destroy$ = new Subject<void>();

  // Service state
  private readonly subscriptions = new Map<string, EventSubscription>();
  private readonly metrics$ = new BehaviorSubject<MessageBusMetrics>(this.initializeMetrics());
  private readonly isHealthy$ = new BehaviorSubject<boolean>(true);

  // Configuration
  private batchConfig: MessageBatchConfig = {
    maxBatchSize: 50,
    maxBatchDelay: 100, // 100ms
    priorityThreshold: EventPriority.HIGH,
    enableBatching: true
  };

  // Correlation tracking for message flows
  private readonly correlationMap = new Map<string, string[]>();

  constructor() {
    this.initializeEventProcessing();
    this.initializeMetricsTracking();
    this.initializeErrorHandling();

    // Log service initialization
    this.logInfo('MessageBusService initialized', { 
      version: this.version,
      batchConfig: this.batchConfig 
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.cleanupResources();
  }

  /**
   * Publish an event to all subscribers
   * 
   * @param event - The service event to publish
   * @returns Promise resolving to operation result
   */
  async publish<T extends ServiceEvent>(event: T): Promise<ServiceOperationResult<void>> {
    try {
      // Validate event structure
      const validationResult = this.validateEvent(event);
      if (!validationResult.success) {
        return validationResult;
      }

      // Enrich event with metadata
      const enrichedEvent = this.enrichEvent(event);

      // Emit to event stream
      this.eventStream$.next(enrichedEvent);

      // Update metrics
      this.updatePublishMetrics(enrichedEvent);

      // Track correlation if present
      if (enrichedEvent.correlationId) {
        this.trackCorrelation(enrichedEvent.correlationId, enrichedEvent.type);
      }

      this.logDebug('Event published', { 
        type: enrichedEvent.type, 
        source: enrichedEvent.source,
        correlationId: enrichedEvent.correlationId 
      });

      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during event publish';
      this.handleError(new Error(`Failed to publish event: ${errorMsg}`));
      
      return { 
        success: false, 
        error: errorMsg 
      };
    }
  }

  /**
   * Subscribe to specific event type
   * 
   * @param eventType - Type of events to subscribe to
   * @param listener - Event handler function
   * @param options - Subscription options
   * @returns Subscription ID for later unsubscription
   */
  subscribe<T extends ServiceEvent>(
    eventType: ServiceEventType,
    listener: ServiceEventListener<T>,
    options: EventSubscriptionOptions = {}
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType,
      listener: listener as ServiceEventListener,
      options,
      subscribedAt: new Date(),
      callCount: 0
    };

    // Create filtered observable for this subscription
    const filteredStream$ = this.createFilteredStream(eventType, options);

    // Set up the subscription with error handling
    filteredStream$
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.handleSubscriptionError(subscriptionId, error);
          return EMPTY;
        })
      )
      .subscribe({
        next: (event) => this.handleEventDelivery(subscription, event),
        error: (error) => this.handleSubscriptionError(subscriptionId, error)
      });

    this.subscriptions.set(subscriptionId, subscription);
    this.updateSubscriptionMetrics();

    this.logDebug('Event subscription created', { 
      subscriptionId, 
      eventType, 
      options 
    });

    return subscriptionId;
  }

  /**
   * Subscribe to all events
   * 
   * @param listener - Event handler function
   * @param options - Subscription options
   * @returns Subscription ID for later unsubscription
   */
  subscribeToAll(
    listener: ServiceEventListener,
    options: EventSubscriptionOptions = {}
  ): string {
    const subscriptionId = this.generateSubscriptionId();
    
    const subscription: EventSubscription = {
      id: subscriptionId,
      eventType: 'ALL',
      listener,
      options,
      subscribedAt: new Date(),
      callCount: 0
    };

    // Create filtered stream for all events
    const filteredStream$ = this.createFilteredStream('ALL', options);

    filteredStream$
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.handleSubscriptionError(subscriptionId, error);
          return EMPTY;
        })
      )
      .subscribe({
        next: (event) => this.handleEventDelivery(subscription, event),
        error: (error) => this.handleSubscriptionError(subscriptionId, error)
      });

    this.subscriptions.set(subscriptionId, subscription);
    this.updateSubscriptionMetrics();

    this.logDebug('Global event subscription created', { subscriptionId, options });

    return subscriptionId;
  }

  /**
   * Unsubscribe from events
   * 
   * @param subscriptionId - ID returned from subscribe method
   * @returns True if subscription was found and removed
   */
  unsubscribe(subscriptionId: string): boolean {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) {
      this.logWarn('Attempted to unsubscribe from non-existent subscription', { subscriptionId });
      return false;
    }

    this.subscriptions.delete(subscriptionId);
    this.updateSubscriptionMetrics();

    this.logDebug('Event subscription removed', { 
      subscriptionId, 
      eventType: subscription.eventType,
      callCount: subscription.callCount 
    });

    return true;
  }

  /**
   * Get observable for specific event type
   * 
   * @param eventType - Type of events to observe
   * @param options - Subscription options
   * @returns Observable stream of events
   */
  getEventStream<T extends ServiceEvent>(
    eventType: ServiceEventType,
    options: EventSubscriptionOptions = {}
  ): Observable<T> {
    return this.createFilteredStream(eventType, options) as Observable<T>;
  }

  /**
   * Get observable for all events
   * 
   * @param options - Subscription options
   * @returns Observable stream of all events
   */
  getAllEventsStream(options: EventSubscriptionOptions = {}): Observable<ServiceEvent> {
    return this.createFilteredStream('ALL', options);
  }

  /**
   * Publish multiple events as a batch
   * 
   * @param events - Array of events to publish
   * @param priority - Batch priority level
   * @returns Promise resolving to operation result
   */
  async publishBatch(
    events: ServiceEvent[], 
    priority: EventPriority = EventPriority.NORMAL
  ): Promise<ServiceOperationResult<void>> {
    if (!events.length) {
      return { success: true };
    }

    try {
      // Validate all events
      for (const event of events) {
        const validationResult = this.validateEvent(event);
        if (!validationResult.success) {
          return validationResult;
        }
      }

      // Create and emit batch
      const batch: MessageBatch = {
        id: this.generateBatchId(),
        events: events.map(event => this.enrichEvent(event)),
        priority,
        createdAt: new Date(),
        size: events.length
      };

      this.batchStream$.next(batch);

      // Update metrics
      this.updateBatchMetrics(batch);

      this.logDebug('Event batch published', { 
        batchId: batch.id, 
        eventCount: batch.size, 
        priority 
      });

      return { success: true };

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during batch publish';
      this.handleError(new Error(`Failed to publish event batch: ${errorMsg}`));
      
      return { 
        success: false, 
        error: errorMsg 
      };
    }
  }

  /**
   * Configure message batching behavior
   * 
   * @param config - New batch configuration
   */
  configureBatching(config: Partial<MessageBatchConfig>): void {
    this.batchConfig = { ...this.batchConfig, ...config };
    
    this.logInfo('Message batching configuration updated', { config: this.batchConfig });
  }

  /**
   * Get current service metrics
   * 
   * @returns Observable of current metrics
   */
  getMetrics(): Observable<MessageBusMetrics> {
    return this.metrics$.asObservable();
  }

  /**
   * Get current service health status
   * 
   * @returns Observable of health status
   */
  getHealthStatus(): Observable<boolean> {
    return this.isHealthy$.asObservable();
  }

  /**
   * Get correlation chain for a correlation ID
   * 
   * @param correlationId - The correlation ID to look up
   * @returns Array of event types in the correlation chain
   */
  getCorrelationChain(correlationId: string): string[] {
    return this.correlationMap.get(correlationId) || [];
  }

  /**
   * Clear all subscriptions and reset state
   */
  reset(): void {
    this.subscriptions.clear();
    this.correlationMap.clear();
    this.metrics$.next(this.initializeMetrics());
    
    this.logInfo('MessageBusService reset completed');
  }

  // Private methods

  private initializeEventProcessing(): void {
    // Handle individual events
    this.eventStream$
      .pipe(
        takeUntil(this.destroy$),
        catchError((error) => {
          this.handleError(error);
          return EMPTY;
        })
      )
      .subscribe();

    // Handle batched events
    this.batchStream$
      .pipe(
        takeUntil(this.destroy$),
        mergeMap(batch => this.processBatch(batch)),
        catchError((error) => {
          this.handleError(error);
          return EMPTY;
        })
      )
      .subscribe();

    // Set up automatic batching for high-frequency events
    if (this.batchConfig.enableBatching) {
      this.setupAutomaticBatching();
    }
  }

  private setupAutomaticBatching(): void {
    this.eventStream$
      .pipe(
        takeUntil(this.destroy$),
        filter(event => this.shouldBatchEvent(event)),
        bufferTime(this.batchConfig.maxBatchDelay, null, this.batchConfig.maxBatchSize),
        filter(events => events.length > 0),
        map(events => this.createAutoBatch(events))
      )
      .subscribe(batch => this.batchStream$.next(batch));
  }

  private createFilteredStream(
    eventType: ServiceEventType | 'ALL',
    options: EventSubscriptionOptions
  ): Observable<ServiceEvent> {
    let stream$ = eventType === 'ALL' 
      ? this.eventStream$.asObservable()
      : this.eventStream$.pipe(filter(event => event.type === eventType));

    // Apply custom filter if provided
    if (options.filter) {
      stream$ = stream$.pipe(filter(options.filter));
    }

    // Apply debouncing if specified
    if (options.debounceMs && options.debounceMs > 0) {
      stream$ = stream$.pipe(debounceTime(options.debounceMs));
    }

    // Apply throttling if specified
    if (options.throttleMs && options.throttleMs > 0) {
      stream$ = stream$.pipe(throttleTime(options.throttleMs));
    }

    // Handle once subscription
    if (options.once) {
      stream$ = stream$.pipe(
        takeUntil(timer(1).pipe(filter(() => false))) // Take only first emission
      );
    }

    return stream$.pipe(
      distinctUntilChanged((prev, curr) => 
        prev.type === curr.type && 
        prev.timestamp.getTime() === curr.timestamp.getTime()
      ),
      share()
    );
  }

  private handleEventDelivery(subscription: EventSubscription, event: ServiceEvent): void {
    try {
      // Update call count
      subscription = { ...subscription, callCount: subscription.callCount + 1 };
      this.subscriptions.set(subscription.id, subscription);

      // Call the listener
      const result = subscription.listener(event);
      
      // Handle async listeners
      if (result instanceof Promise) {
        result.catch(error => 
          this.handleSubscriptionError(subscription.id, error)
        );
      }

      // Update delivery metrics
      this.updateDeliveryMetrics(event);

    } catch (error) {
      this.handleSubscriptionError(subscription.id, error);
    }
  }

  private handleSubscriptionError(subscriptionId: string, error: unknown): void {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    
    this.logError('Subscription error occurred', {
      subscriptionId,
      error: errorObj.message,
      stack: errorObj.stack
    });

    this.errorStream$.next(errorObj);
  }

  private processBatch(batch: MessageBatch): Observable<never> {
    // Process each event in the batch
    batch.events.forEach(event => {
      this.eventStream$.next(event);
    });

    return EMPTY;
  }

  private validateEvent(event: ServiceEvent): ServiceOperationResult<void> {
    if (!event) {
      return { success: false, error: 'Event cannot be null or undefined' };
    }

    if (!event.type) {
      return { success: false, error: 'Event must have a type' };
    }

    if (!event.source) {
      return { success: false, error: 'Event must have a source' };
    }

    if (!event.timestamp) {
      return { success: false, error: 'Event must have a timestamp' };
    }

    return { success: true };
  }

  private enrichEvent<T extends ServiceEvent>(event: T): T {
    // Add correlation ID if not present
    if (!event.correlationId) {
      return {
        ...event,
        correlationId: this.generateCorrelationId()
      };
    }

    return event;
  }

  private shouldBatchEvent(event: ServiceEvent): boolean {
    return event.priority !== undefined && event.priority < this.batchConfig.priorityThreshold;
  }

  private createAutoBatch(events: ServiceEvent[]): MessageBatch {
    const highestPriority = Math.max(...events.map(e => e.priority || EventPriority.NORMAL));
    
    return {
      id: this.generateBatchId(),
      events,
      priority: highestPriority as EventPriority,
      createdAt: new Date(),
      size: events.length
    };
  }

  private initializeMetrics(): MessageBusMetrics {
    return {
      operationsPerformed: 0,
      averageResponseTime: 0,
      errorRate: 0,
      totalEventsPublished: 0,
      totalEventsDelivered: 0,
      activeSubscriptions: 0,
      batchesProcessed: 0,
      averageBatchSize: 0,
      eventTypeCounts: {}
    };
  }

  private initializeMetricsTracking(): void {
    // Update metrics every 30 seconds
    timer(0, 30000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.updateMetrics());
  }

  private initializeErrorHandling(): void {
    this.errorStream$
      .pipe(
        takeUntil(this.destroy$),
        bufferTime(5000) // Collect errors over 5 second windows
      )
      .subscribe(errors => {
        if (errors.length > 0) {
          this.updateHealthStatus(errors);
        }
      });
  }

  private updatePublishMetrics(event: ServiceEvent): void {
    const current = this.metrics$.value;
    const eventTypeCounts = { ...current.eventTypeCounts };
    eventTypeCounts[event.type] = (eventTypeCounts[event.type] || 0) + 1;

    this.metrics$.next({
      ...current,
      totalEventsPublished: current.totalEventsPublished + 1,
      operationsPerformed: current.operationsPerformed + 1,
      eventTypeCounts
    });
  }

  private updateDeliveryMetrics(event: ServiceEvent): void {
    const current = this.metrics$.value;
    this.metrics$.next({
      ...current,
      totalEventsDelivered: current.totalEventsDelivered + 1
    });
  }

  private updateBatchMetrics(batch: MessageBatch): void {
    const current = this.metrics$.value;
    const newBatchCount = current.batchesProcessed + 1;
    const totalBatchSize = (current.averageBatchSize * current.batchesProcessed) + batch.size;
    
    this.metrics$.next({
      ...current,
      batchesProcessed: newBatchCount,
      averageBatchSize: totalBatchSize / newBatchCount
    });
  }

  private updateSubscriptionMetrics(): void {
    const current = this.metrics$.value;
    this.metrics$.next({
      ...current,
      activeSubscriptions: this.subscriptions.size
    });
  }

  private updateMetrics(): void {
    // This method can be extended to calculate more complex metrics
    // like average response time, error rates, etc.
  }

  private updateHealthStatus(errors: Error[]): void {
    const errorRate = errors.length / (this.metrics$.value.operationsPerformed || 1);
    const isHealthy = errorRate < 0.05; // Consider unhealthy if error rate > 5%
    
    this.isHealthy$.next(isHealthy);
    
    const current = this.metrics$.value;
    this.metrics$.next({
      ...current,
      errorRate
    });
  }

  private trackCorrelation(correlationId: string, eventType: string): void {
    const chain = this.correlationMap.get(correlationId) || [];
    chain.push(eventType);
    this.correlationMap.set(correlationId, chain);

    // Clean up old correlations (keep only last 1000)
    if (this.correlationMap.size > 1000) {
      const oldestKey = this.correlationMap.keys().next().value;
      if (oldestKey) {
        this.correlationMap.delete(oldestKey);
      }
    }
  }

  private handleError(error: Error): void {
    this.errorStream$.next(error);
    this.logError('MessageBusService error', { 
      error: error.message, 
      stack: error.stack 
    });
  }

  private cleanupResources(): void {
    this.subscriptions.clear();
    this.correlationMap.clear();
    this.logInfo('MessageBusService resources cleaned up');
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBatchId(): string {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Logging methods (these would typically use a proper logging service)
  private logDebug(message: string, context?: any): void {
    console.debug(`[${this.serviceName}] ${message}`, context);
  }

  private logInfo(message: string, context?: any): void {
    console.info(`[${this.serviceName}] ${message}`, context);
  }

  private logWarn(message: string, context?: any): void {
    console.warn(`[${this.serviceName}] ${message}`, context);
  }

  private logError(message: string, context?: any): void {
    console.error(`[${this.serviceName}] ${message}`, context);
  }
}