import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-parameters',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './parameters.html',
  styleUrl: './parameters.scss',
})
export class ParametersComponent {}