import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { UserSession } from '../../models/UserSession';
import Cookies from 'js-cookie';
import { ModalService } from '../../services/modal.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {

  accountMenuVisible:boolean = false;
  menuTimeout:any;
  userIsSignedIn:boolean = false;
  showInviteCodesMenuOption:boolean = false;
  isAdmin:boolean = false;

  constructor(private userService:UserService, private modalService: ModalService, private router: Router) {
  }

  ngOnInit(): void {

    this.userService.sessionObs.subscribe((session:UserSession) => {
      if(session && session.eppn != null) {
        this.userIsSignedIn = true;
        let userSession = this.userService.getSession();
        if(userSession?.privileges?.createInviteCodes) {
          this.showInviteCodesMenuOption = true;
        }
        this.isAdmin = !!userSession?.privileges?.sysAdmin;
      }
      else {
        this.userIsSignedIn = false;
        this.isAdmin = false;
      }
    });

    let userSession = this.userService.getSession();
    if(userSession) {
      this.userIsSignedIn = true;
      this.showInviteCodesMenuOption = !!userSession?.privileges?.createInviteCodes;
      this.isAdmin = !!userSession?.privileges?.sysAdmin;
    }
  }

  getUserDisplayName():string {
    let session = this.userService.getSession();
    if(session == null || !session.fullName) {
      return 'Not logged in';
    }
    return session.fullName;
  }

  getUserInitials():string {
    const session = this.userService.getSession();
    const first = session?.firstName?.trim()?.charAt(0) || '';
    const last = session?.lastName?.trim()?.charAt(0) || '';
    const initials = (first + last).toUpperCase();
    return initials || 'VS';
  }

  getUserRole():string {
    const session = this.userService.getSession();
    if(!session?.privileges) {
      return 'User';
    }

    if(session.privileges.createProjects || session.privileges.createInviteCodes) {
      return 'Project admin';
    }

    return 'Researcher';
  }

  showAccountMenu(show:boolean = true, useTimer = false) {
    clearTimeout(this.menuTimeout);
    if(useTimer) {
      this.menuTimeout = setTimeout(() => {
        this.accountMenuVisible = show;
      }, 450);
    }
    else {
      this.accountMenuVisible = show;
    }
  }

  showInviteCodesDialog() {
    this.modalService.showModal('invite-codes-dialog');
  }

  showHelpDialog() {
    this.modalService.showModal('help-dialog');
  }

  openAdminPanel() {
    this.router.navigate(['/admin']);
  }

  signIn() {
    this.userService.redirectToAuthentication();
  }

  async signOut() {

    this.userService.signOut().subscribe((response) => {
      console.log(response);
      Cookies.set('SessionAccessCode', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('PHPSESSID', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('PHPSESSID', '', { domain: '.'+window.location.hostname, path: '/', secure: true, sameSite: 'None' });
      Cookies.set('ProjectId', '', { domain: window.location.hostname, path: '/', secure: true, sameSite: 'None' });

      document.cookie = 'cookieName=SessionAccessCode; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'cookieName=PHPSESSID; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'cookieName=ProjectId; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';

      if(environment.production) {
        window.location.href = '/Shibboleth.sso/Logout?return=https://'+window.location.hostname;
      }
      else {
        window.location.href = '/';
      }
    });

  }

}
