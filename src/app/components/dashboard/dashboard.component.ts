import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import { SystemService } from '../../services/system.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  userAuthenticationCheckPerformed:boolean = false;
  modalActive:boolean = false;
  modalName:string = '';
  modalArgs:any[] = [];
  userIsAuthenticated:boolean = false;
  userIsAuthorized:boolean = false;
  userFullName:string = '';

  constructor(
    private userService:UserService,
    private systemService: SystemService,
    private modalService: ModalService
  ) {
    this.userFullName = (window as any).visp?.fullName || '';

    this.userService.eventEmitter.subscribe((event) => {
      if(event === 'userAuthentication') {
        this.userIsAuthenticated = this.userService.userIsAuthenticated;
        this.userAuthenticationCheckPerformed = true;
      }

      if(event === 'userAuthorization') {
        this.userIsAuthorized = this.userService.userIsAuthorized;
      }
    });

    this.userAuthenticationCheckPerformed = this.userService.userAuthenticationCheckPerformed;
    this.userIsAuthenticated = this.userService.userIsAuthenticated;
    this.userIsAuthorized = this.userService.userIsAuthorized;
  }

  ngOnInit(): void {
    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
      this.modalArgs = modal.args || [];
    });

    this.systemService.setCurrentApplication('dashboard');
  }

  get showSignedOutFrontpage():boolean {
    return this.userAuthenticationCheckPerformed && !this.userIsAuthenticated;
  }

}
