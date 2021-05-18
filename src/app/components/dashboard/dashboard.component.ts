import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { Session } from "../../models/Session";
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

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService) {
    this.notifier = notifierService;

    systemService.eventEmitter.subscribe((event) => {
      if(event == "gitlabIsReady") {
        this.systemIsReady = true;
      }
      if(event == "gitlabIsNotReady") {
        this.systemIsReady = false;
      }
    });
  }

  ngOnInit(): void {
    window.addEventListener('userSessionUpdated', () => {
      this.userIsSignedIn = this.userService.userIsSignedIn;
    });
  }
}
