import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Navigation } from './layout/nav/navigation';

@Component({
  imports: [RouterModule, Navigation],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'info-prop-frmwrk-ui';
}
