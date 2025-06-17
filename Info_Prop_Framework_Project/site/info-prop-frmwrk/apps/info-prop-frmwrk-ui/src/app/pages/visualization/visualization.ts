import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-visualization',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './visualization.html',
  styleUrl: './visualization.scss',
})
export class VisualizationComponent {}