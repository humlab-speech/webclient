import { Component, OnInit, Input } from '@angular/core';
import { Infobox } from "../../models/Infobox";
import { environment } from 'src/environments/environment';
import { ShepherdService } from '../../services/shepherd.service';
import { UserService } from '../../services/user.service'; // Import UserService

@Component({
  selector: 'app-infobox',
  templateUrl: './infobox.component.html',
  styleUrls: ['./infobox.component.scss']
})
export class InfoboxComponent implements OnInit {
  
  @Input() infobox: Infobox;
  baseDomain:string = window.location.hostname;
  octraEnabled:boolean = false;
  labjsEnabled:boolean = false;
  emuWebAppEnabled:boolean = false;
  userIsLoggedIn:boolean = false;

  constructor(
    private shepherdService: ShepherdService,
    private userService: UserService // Inject UserService
  ) { }

  ngOnInit(): void {
    this.octraEnabled = environment.ENABLED_APPLICATIONS.includes("octra");
    this.labjsEnabled = environment.ENABLED_APPLICATIONS.includes("labjs");
    this.emuWebAppEnabled = environment.ENABLED_APPLICATIONS.includes("emu-webapp");

    this.userService.fetchSession().subscribe((userSession) => {
      if(userSession.eppn) {
        this.userIsLoggedIn = true;
      }
    });
  }

  tutorial() {
    console.log("Tutorial starting");
    this.shepherdService.startTour();
  }
}
