import { Component, OnInit } from '@angular/core';
import { UserService } from "../../services/user.service";
import { Session } from "../../models/Session";

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent implements OnInit {

  accountMenuVisible:boolean = false;
  menuTimeout:any;
  userIsSignedIn:boolean = true;

  constructor(private userService:UserService) { }

  ngOnInit(): void {
    /*
    let session = this.userService.getSession();
    if(session == null) {
      this.userIsSignedIn = false;
    }
    else {
      this.userIsSignedIn = true;
    }
    */
  }

  onNotify(evt) {
    console.log("event received!", evt);
  }

  getUserDisplayName():string {
    let session = this.userService.getSession();
    if(session == null) {
      return "Not logged in";
    }
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
    console.log('Signout');
    //window.location.href = 'https://localtest.me/Shibboleth.sso/Logout?return=https://localtest.me/api/v1/signout';
    window.location.href = '/Shibboleth.sso/Logout?return=https://speech.humlab.umu.se/api/v1/signout';
  }

}
