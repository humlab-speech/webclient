import { Component, OnInit, Input } from '@angular/core';
import { Infobox } from '../../models/Infobox';
import { environment } from 'src/environments/environment';
import { ShepherdService } from '../../services/shepherd.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-infobox',
  templateUrl: './infobox.component.html',
  styleUrls: ['./infobox.component.scss']
})
export class InfoboxComponent implements OnInit {

  @Input() infobox: Infobox;
  emuWebAppEnabled:boolean = false;
  userIsLoggedIn:boolean = false;

  constructor(
    private shepherdService: ShepherdService,
    private userService: UserService
  ) { }

  ngOnInit(): void {
    this.emuWebAppEnabled = environment.ENABLED_APPLICATIONS.includes('arctic');
    this.userIsLoggedIn = !!this.userService.getSession()?.eppn;

    this.userService.sessionObs.subscribe((userSession) => {
      this.userIsLoggedIn = !!userSession?.eppn;
    });
  }

  tutorial() {
    this.shepherdService.startTour();
  }
}
