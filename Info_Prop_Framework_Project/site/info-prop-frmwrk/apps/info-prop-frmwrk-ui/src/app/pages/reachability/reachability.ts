import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-reachability',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './reachability.html',
  styleUrl: './reachability.scss',
})
export class ReachabilityComponent {}