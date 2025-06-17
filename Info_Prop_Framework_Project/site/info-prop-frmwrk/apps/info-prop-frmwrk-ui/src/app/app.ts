import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NavigationComponent } from './layout/navigation/navigation.component';

@Component({
  imports: [RouterModule, NavigationComponent],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'info-prop-frmwrk-ui';
}