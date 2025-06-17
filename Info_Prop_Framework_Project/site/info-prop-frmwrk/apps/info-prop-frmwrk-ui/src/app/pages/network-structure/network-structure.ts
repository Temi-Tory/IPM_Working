import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-network-structure',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './network-structure.html',
  styleUrl: './network-structure.scss',
})
export class NetworkStructureComponent {}