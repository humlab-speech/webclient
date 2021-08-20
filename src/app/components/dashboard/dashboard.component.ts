import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";
import { NotifierService } from 'angular-notifier';
import { SystemService } from '../../services/system.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  userIsSignedIn:boolean = false;
  modalActive:boolean = false;
  modalName:string = "";
  systemIsReady:boolean = true;
  userPassedAccessListCheck:boolean = false;
  gitlabReady:boolean = false;
  userAccessListCheckPerformed:boolean = false;

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService) {
    this.notifier = notifierService;

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
  }

  ngOnInit(): void {
    window.addEventListener('userSessionUpdated', () => {
      this.userIsSignedIn = this.userService.userIsSignedIn;
    });
  }
}
