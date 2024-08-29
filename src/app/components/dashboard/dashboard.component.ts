import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";
import { NotifierService } from 'angular-notifier';
import { SystemService } from '../../services/system.service';
import { ModalService } from '../../services/modal.service';
import { environment } from 'src/environments/environment';
import { nanoid } from 'nanoid';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  
  userAuthenticationCheckPerformed:boolean = false;
  modalActive:boolean = false;
  modalName:string = "";
  userIsAuthenticated:boolean = false;
  userIsAuthorized:boolean = false;
  gitlabReady:boolean = false;
  systemService:any = null;
  applicationName:string = environment.APPLICATION_NAME;

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService, private modalService: ModalService) {
    this.notifier = notifierService;
    this.systemService = systemService;

    userService.eventEmitter.subscribe((event) => {
      if(event == "userAuthentication") {
        if(!userService.userIsAuthenticated) {
          this.userIsAuthenticated = false;
          console.log("Received userAuthentication event, user is not authenticated");
        }
        else {
          this.userIsAuthenticated = true;
          console.log("Received userAuthentication event, user is now authenticated");
        }
        this.userAuthenticationCheckPerformed = true;
      }
      if(event == "userAuthorization") {
        if(!userService.userIsAuthorized) {
          this.userIsAuthorized = false;
          console.log("Received userAuthorization event, user is not authorized");
        }
        else {
          this.userIsAuthorized = true;
          console.log("Received userAuthorization event, user is now authorized");
        }
      }
    });
    
  }

  ngOnInit(): void {
    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
    });
  }

  closeModal() {
    this.modalService.hideModal("invite-codes-dialog");
  }

}
