import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";
import { RouterModule } from "@angular/router";

@Component({
  selector: 'app-network-setup',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './network-upload.component.html',
  styleUrl: './network-upload.component.scss'
})
export class NetworkUploadComponent {
    // User can upload a the DAG.EGDES file here
    //  as well as node priror probabilities.json fiel (for diamond processing )
    // as well as edge probabilities.json file (for diamond processing and recahbility anlsysis)
    
}