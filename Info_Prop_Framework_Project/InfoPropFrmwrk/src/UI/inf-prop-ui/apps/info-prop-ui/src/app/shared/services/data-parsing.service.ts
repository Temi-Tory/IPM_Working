import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { 
  ParsedFloatData,
  ParsedPboxData,
  ParsedIntervalData,
  ParsedCapacityData,
  ParsedCpmData
} from '../models/network-analysis.models';

@Injectable({
  providedIn: 'root'
})
export class DataParsingService {

  /**
   * Parse uploaded files that are already available in the UI
   * No need to fetch from server - files were just uploaded!
   */
  parseUploadedFiles(uploadedFiles: FileList): Observable<{
    float?: ParsedFloatData;
    pbox?: ParsedPboxData;
    interval?: ParsedIntervalData;
    capacity?: ParsedCapacityData;
    cpm?: ParsedCpmData;
  }> {
    const parsePromises: Promise<unknown>[] = [];
    const results: {
      float?: ParsedFloatData;
      pbox?: ParsedPboxData;
      interval?: ParsedIntervalData;
      capacity?: ParsedCapacityData;
      cpm?: ParsedCpmData;
    } = {};

    Array.from(uploadedFiles).forEach(file => {
      const fileName = file.name.toLowerCase();
      
      if (fileName.includes('nodepriors') && fileName.endsWith('.json')) {
        parsePromises.push(this.parseFileContent(file).then(data => {
          const dataType = this.getDataType(fileName);
          if (!results[dataType]) results[dataType] = {} as any;
          (results[dataType] as any).node_priors = this.convertToStringKeys(data);
        }));
      } else if (fileName.includes('linkprob') && fileName.endsWith('.json')) {
        parsePromises.push(this.parseFileContent(file).then(data => {
          const dataType = this.getDataType(fileName);
          if (!results[dataType]) results[dataType] = {} as any;
          (results[dataType] as any).edge_probabilities = this.convertEdgesToStringKeys(data);
        }));
      } else if (fileName.includes('capacities') && fileName.endsWith('.json')) {
        parsePromises.push(this.parseFileContent(file).then(data => {
          results.capacity = this.parseCapacityData(data);
        }));
      } else if (fileName.includes('cpm') && fileName.endsWith('.json')) {
        parsePromises.push(this.parseFileContent(file).then(data => {
          results.cpm = this.parseCpmData(data);
        }));
      }
    });

    if (parsePromises.length === 0) {
      return of({});
    }

    return new Observable(observer => {
      Promise.all(parsePromises).then(() => {
        console.log('✅ DataParsingService: Successfully parsed files:', results);
        console.log('📊 Parsed data structure:', {
          float: results.float ? Object.keys(results.float) : 'none',
          interval: results.interval ? Object.keys(results.interval) : 'none',
          pbox: results.pbox ? Object.keys(results.pbox) : 'none',
          capacity: results.capacity ? Object.keys(results.capacity) : 'none',
          cpm: results.cpm ? Object.keys(results.cpm) : 'none'
        });
        observer.next(results);
        observer.complete();
      }).catch(error => {
        console.warn('❌ DataParsingService: Failed to parse uploaded files:', error);
        observer.next({});
        observer.complete();
      });
    });
  }

  private parseFileContent(file: File): Promise<any> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const content = JSON.parse(reader.result as string);
          resolve(content);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private getDataType(fileName: string): 'float' | 'pbox' | 'interval' {
    if (fileName.includes('float')) return 'float';
    if (fileName.includes('pbox')) return 'pbox';
    if (fileName.includes('interval')) return 'interval';
    return 'float'; // default
  }

  private parseCapacityData(data: any): ParsedCapacityData {
    return {
      capacities: {
        nodes: data.capacities?.nodes || {},
        edges: data.capacities?.edges || {},
        source_rates: data.capacities?.source_rates || {}
      }
    };
  }

  private parseCpmData(data: any): ParsedCpmData {
    return {
      cpm_data: data
    };
  }

  private convertToStringKeys(obj: Record<string | number, any>): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      result[String(key)] = value;
    });
    return result;
  }

  private convertEdgesToStringKeys(obj: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    Object.entries(obj).forEach(([key, value]) => {
      // Keep original "(source,target)" format for consistency with backend and file structure
      result[key] = value;
    });
    return result;
  }
}