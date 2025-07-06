import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { Navigation } from './layout/nav/navigation';
import { Spinner } from './shared/spinner/spinner';

@Component({
  imports: [RouterModule, Navigation, Spinner],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'info-prop-frmwrk-ui';
}
