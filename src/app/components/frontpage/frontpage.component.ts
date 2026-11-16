import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-frontpage',
  templateUrl: './frontpage.component.html',
  styleUrls: ['./frontpage.component.scss']
})
export class FrontpageComponent {
  readonly trattEnabled = environment.ENABLED_APPLICATIONS.includes('tratt');
  readonly trattUrl = `https://tratt.${window.location.hostname}`;
}
