import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'formatNumber',
  standalone: true
})
export class FormatNumberPipe implements PipeTransform {
  transform(value: number | null | undefined, decimals = 2): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '0';
    }

    if (Math.abs(value) >= 1e9) {
      return (value / 1e9).toFixed(decimals) + 'B';
    }
    
    if (Math.abs(value) >= 1e6) {
      return (value / 1e6).toFixed(decimals) + 'M';
    }
    
    if (Math.abs(value) >= 1e3) {
      return (value / 1e3).toFixed(decimals) + 'K';
    }
    
    return value.toFixed(decimals);
  }
}