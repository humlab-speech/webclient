import { Component } from '@angular/core';
import { environment } from 'src/environments/environment';
import { trattSubdomain } from 'src/app/models/TrattUrl';

@Component({
  selector: 'app-frontpage',
  templateUrl: './frontpage.component.html',
  styleUrls: ['./frontpage.component.scss']
})
export class FrontpageComponent {
  readonly trattEnabled = environment.ENABLED_APPLICATIONS.includes('tratt');
  readonly trattUrl = `https://${trattSubdomain()}.${window.location.hostname}`;
}
