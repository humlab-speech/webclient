import { Component, OnInit, Input } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";
import Cookies from 'js-cookie';
import { ModalService } from '../../services/modal.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {

  accountMenuVisible:boolean = false;
  menuTimeout:any;
  userIsSignedIn:boolean = false;
  showInviteUserDialogToggle:boolean = false;
  showInviteCodesMenuOption:boolean = false;

  constructor(private userService:UserService, private modalService: ModalService) {
  }

  ngOnInit(): void {

    this.userService.sessionObs.subscribe((session:UserSession) => {
      if(session && session.eppn != null) {
        this.userIsSignedIn = true;
        let userSession = this.userService.getSession();
        console.log("User session", userSession);
        if(userSession.privileges.createInviteCodes) {
          this.showInviteCodesMenuOption = true;
        }
      }
      else {
        this.userIsSignedIn = false;
      }
    });

    let userSession = this.userService.getSession();
    if(userSession) {
      this.userIsSignedIn = true;
    }
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

  showInviteCodesDialog() {
    this.modalService.showModal("invite-codes-dialog");
  }

  showHelpDialog() {
    this.modalService.showModal("help-dialog");
  }

  async signOut() {
    console.log("Signing out");

    //ask the server to sign us out
    this.userService.signOut().subscribe((response) => {
      console.log(response);
      console.log('.'+window.location.hostname);
      //clear cookies
      Cookies.set('SessionAccessCode', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('PHPSESSID', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('PHPSESSID', '', { domain: '.'+window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('ProjectId', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      
      document.cookie = "cookieName=SessionAccessCode; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "cookieName=PHPSESSID; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
      document.cookie = "cookieName=ProjectId; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

      if(environment.production) {
        window.location.href = '/Shibboleth.sso/Logout?return=https://'+window.location.hostname+'/api/v1/signout';
      }
      else {
        window.location.href = '/';
      }
    });
    
  }

}
