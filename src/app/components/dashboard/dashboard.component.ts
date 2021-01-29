import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { Session } from "../../models/Session";

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  userIsSignedIn:boolean = false;

  constructor(private userService:UserService) { }

  ngOnInit(): void {
    this.userService.sessionObs.subscribe((session:Session) => {
      console.log("Session updated", session);
      if(session.email != null) {
        this.userIsSignedIn = true;
      }
      else {
        this.userIsSignedIn = false;
      }
    });

  }

}
