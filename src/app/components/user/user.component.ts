import { Component, OnInit, Input } from '@angular/core';
import { UserService } from "../../services/user.service";
import { UserSession } from "../../models/UserSession";
import Cookies from 'js-cookie';
import { ModalService } from '../../services/modal.service';

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

  constructor(private userService:UserService, private modalService: ModalService) {
  }

  ngOnInit(): void {
    this.userService.fetchSession().subscribe((userSess:any) => {
      if(userSess.body.eppn) {
        this.userIsSignedIn = true;
      }
    });
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

  inviteUser() {
    console.log("Invite user");
    this.userService.generateInviteCode().subscribe((response:any) => {
      console.log(response);
      let inviteCode = response.result;
      console.log(inviteCode);
    });
  }

  signOut() {
    //clear cookies
    Cookies.set('SessionAccessCode', '', { domain: window.location.hostname, secure: true, sameSite: 'None' });
    Cookies.set('PHPSESSID', '', { domain: window.location.hostname, secure: true, sameSite: 'None' });
    Cookies.set('ProjectId', '', { domain: window.location.hostname, secure: true, sameSite: 'None' });
    
    document.cookie = "cookieName=SessionAccessCode; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "cookieName=PHPSESSID; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "cookieName=ProjectId; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

    window.location.href = '/Shibboleth.sso/Logout?return=https://'+window.location.hostname+'/api/v1/signout';
  }

}
