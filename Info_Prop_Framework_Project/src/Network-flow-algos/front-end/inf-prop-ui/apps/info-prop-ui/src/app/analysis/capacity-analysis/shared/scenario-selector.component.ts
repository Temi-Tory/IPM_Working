import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScenarioInfo } from '../../../shared/models/network-analysis.models';

export type Level = 0 | 1 | 2 | 3;

/**
 * Scenario and level selector with breadcrumb and level tabs
 * Emits scenario and level changes
 */
@Component({
  selector: 'app-scenario-selector',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './scenario-selector.component.html',
  styleUrls: ['./scenario-selector.component.scss']
})
export class ScenarioSelectorComponent {
  @Input() scenarios: ScenarioInfo[] = [];
  @Input() currentScenario = '';
  @Input() currentLevel: Level = 0;
  @Output() scenarioChange = new EventEmitter<string>();
  @Output() levelChange = new EventEmitter<Level>();

  isDropdownOpen = signal(false);

  toggleDropdown(): void {
    this.isDropdownOpen.update(open => !open);
  }

  selectScenario(name: string): void {
    this.scenarioChange.emit(name);
    this.isDropdownOpen.set(false);
  }

  selectLevel(level: Level): void {
    this.levelChange.emit(level);
  }

  getCurrentScenarioName(): string {
    const current = this.scenarios.find((s) => s.name === this.currentScenario);
    return current?.displayName || current?.name || this.currentScenario;
  }

  getLevelName(level: Level): string {
    const names = ['Health Check', 'Bottlenecks', 'Flow Paths', 'Scenarios'];
    return names[level] || '';
  }

  getLevels(): Level[] {
    return [0, 1, 2, 3];
  }
}
