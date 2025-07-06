import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

@Component({
  selector: 'app-network-setup',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './network-details.component.html',
  styleUrl: './network-details.component.scss'
})
export class NetworkDetailsComponent {
    // will display graph strcture detaisl form api here
}