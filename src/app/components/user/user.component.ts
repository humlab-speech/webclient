import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {

  accountMenuVisible:boolean = false;
  menuTimeout:any;
  userIsSignedIn:boolean = false;

  constructor(private userService:UserService) { }

  ngOnInit(): void {
    this.getUserDisplayName();
  }

  onNotify(evt) {
    console.log("event received!", evt);
  }

  getUserDisplayName():string {
    let session = this.userService.getSession();
    if(session == null) {
      this.userIsSignedIn = false;
      return "Not logged in";
    }
    this.userIsSignedIn = true;
    return session.fullName;
  }

  showAccountMenu(show:boolean = true, useTimer = false) {
    clearTimeout(this.menuTimeout);
    if(useTimer) {
      this.menuTimeout = setTimeout(() => {
        this.accountMenuVisible = show;
      }, 500);
    }
    else {
      this.accountMenuVisible = show;
    }
  }

  signOut() {
    window.location.href = '/Shibboleth.sso/Logout?return=https://'+window.location.hostname+'/api/v1/signout';
  }

}
