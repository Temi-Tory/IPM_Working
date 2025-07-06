import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-critical-path',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './critical-path.html',
  styleUrl: './critical-path.scss',
})
export class CriticalPathComponent {}