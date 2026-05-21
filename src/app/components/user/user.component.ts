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

    // Step 1: Notify session-manager via WebSocket (clears phpSessionId from MongoDB and logs the sign-out)
    this.userService.signOut().subscribe(async (response) => {
      // Step 2: Destroy the PHP session server-side — this sends a proper Set-Cookie header
      // that expires PHPSESSID, which is the authoritative way to invalidate the server session.
      try {
        await fetch('/api/v1/signout', { redirect: 'manual' });
      } catch (_) {
        // Continue with client-side cleanup even if the request fails
      }

      // Step 3: Delete cookies client-side as a belt-and-suspenders measure.
      // Note: _shibsession_* is HttpOnly and cannot be touched from JavaScript;
      // the /Shibboleth.sso/Logout redirect in step 4 handles it server-side.
      Cookies.remove('SessionAccessCode', { path: '/' });
      Cookies.remove('PHPSESSID', { path: '/' });
      Cookies.remove('PHPSESSID', { path: '/', domain: '.' + window.location.hostname });
      Cookies.remove('ProjectId', { path: '/' });

      // Step 4: Redirect through the Shibboleth SP logout endpoint. This is required in
      // both dev and prod: mod_shib clears the HttpOnly _shibsession_* cookie server-side,
      // which cannot be removed from JavaScript. Without this, index.php would see a still-
      // valid Shibboleth session on the next request and immediately re-authenticate the user.
      // If there is no active Shibboleth session (e.g. test-user logins), mod_shib simply
      // redirects to the return URL without error.
      window.location.href = '/Shibboleth.sso/Logout?return=https://'+window.location.hostname;
    });

  }

}
