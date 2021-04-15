import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { Session } from "../../models/Session";
import { NotifierService } from 'angular-notifier';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  userIsSignedIn:boolean = false;
  modalActive:boolean = false;
  modalName:string = "";

  private readonly notifier: NotifierService;

  constructor(private userService:UserService, notifierService: NotifierService) {
    this.notifier = notifierService;
    
  }

  ngOnInit(): void {
    window.addEventListener('userSessionUpdated', () => {
      this.userIsSignedIn = this.userService.userIsSignedIn;
    });
  }
}
