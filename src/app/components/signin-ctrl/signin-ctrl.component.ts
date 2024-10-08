import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";


@Component({
  selector: 'app-signin-ctrl',
  templateUrl: './signin-ctrl.component.html',
  styleUrls: ['./signin-ctrl.component.scss']
})
export class SigninCtrlComponent implements OnInit {

  userIsSignedIn:boolean = false;

  constructor(private userService:UserService) { }

  ngOnInit():void {
    /*
    this.userService.sessionObs.subscribe((session:Session) => {
      console.log("Session updated", session);
      if(session.email != null) {
        this.userIsSignedIn = true;
      }
      else {
        this.userIsSignedIn = false;
      }
    });
    */
  }

  signIn() {
    this.userService.redirectToAuthentication();
  }

}
