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

  userIsSignedIn:boolean = false;
  userSignedInCheckPerformed:boolean = false;
  signInTimeoutExpired:boolean = false;
  modalActive:boolean = false;
  modalName:string = "";
  userIsAuthorized:boolean = true;
  gitlabReady:boolean = false;
  systemService:any = null;
  applicationName:string = environment.APPLICATION_NAME;

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService, systemService: SystemService, private modalService: ModalService) {

    this.notifier = notifierService;
    this.systemService = systemService;

    systemService.eventEmitter.subscribe((event) => {
      if(event == "userAuthorization") {
        if(!systemService.userIsAuthorized) {
          this.userIsAuthorized = false;
          //console.log("Received userAuthorization event, user is not authorized");
        }
        else {
          this.userIsAuthorized = true;
          //console.log("Received userAuthorization event, user is now authorized");
        }
      }
    });

    setTimeout(() => {
      this.signInTimeoutExpired = true;
    }, 1000);
  }

  ngOnInit(): void {
    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
    });

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

  closeModal() {
    this.modalService.hideModal("invite-codes-dialog");
  }

}
