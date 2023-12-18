import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";
import { NotifierService } from 'angular-notifier';
import { SystemService } from '../../services/system.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  userIsSignedIn:boolean = false;
  userSignedInCheckPerformed:boolean = false;
  signInTimeoutExpired:boolean = false;
  modalActive:boolean = false;
  modalName:string = "";
  userPassedAccessListCheck:boolean = false;
  gitlabReady:boolean = false;
  systemService:any = null;
  applicationName:string = environment.APPLICATION_NAME;

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService) {
    console.log(environment.APPLICATION_NAME);

    this.notifier = notifierService;
    this.systemService = systemService;

    systemService.eventEmitter.subscribe((event) => {
      if(event == "userAuthentication") {
        if(!systemService.userIsAuthenticated) {
          this.userPassedAccessListCheck = false;
        }
        else {
          this.userPassedAccessListCheck = true;
        }
      }
    });

    setTimeout(() => {
      this.signInTimeoutExpired = true;
    }, 1000);
  }

  ngOnInit(): void {
    let session = this.userService.getSession();
    this.userSignedInCheckPerformed = true;
    if(session != null) {
      this.userIsSignedIn = true;
      console.log("User is now signed in");
    }
    else {
      this.userService.fetchSession().subscribe((response) => {
        if(response.code == 200) {
          this.userIsSignedIn = true;
          console.log("User is now signed in");
        }
      });
    }
  }

}
