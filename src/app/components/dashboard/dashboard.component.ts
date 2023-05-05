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
  systemIsReady:boolean = false;
  userPassedAccessListCheck:boolean = false;
  gitlabReady:boolean = false;
  userAccessListCheckPerformed:boolean = false;
  systemService:any = null;
  applicationName:string = environment.APPLICATION_NAME;

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService) {
    console.log(environment.APPLICATION_NAME);

    this.notifier = notifierService;
    this.systemService = systemService;

    this.gitlabReady = this.systemService.gitlabIsReady;
    this.systemIsReady = this.gitlabReady;

    systemService.eventEmitter.subscribe((event) => {
      if(event == "gitlabIsReady") {
        this.gitlabReady = true;
        this.systemIsReady = true;
      }
      if(event == "gitlabIsNotReady") {
        this.gitlabReady = false;
        this.systemIsReady = false;
      }
      if(event == "userAuthentication") {
        this.userAccessListCheckPerformed = true;
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
    }

    if(this.systemService.getUserAuthenticationStatus() == "authenticated") {
      this.userPassedAccessListCheck = true;
      this.userAccessListCheckPerformed = true;
    }

    if(this.systemService.getUserAuthenticationStatus() == "rejected") {
      this.userPassedAccessListCheck = false;
      this.userAccessListCheckPerformed = true;
    }

    window.addEventListener('userSessionUpdated', () => {
      this.userIsSignedIn = this.userService.userIsSignedIn;
    });
  }

}
