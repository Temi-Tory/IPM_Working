import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-diamond-analysis',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './diamond-analysis.html',
  styleUrl: './diamond-analysis.scss',
})
export class DiamondAnalysisComponent {}