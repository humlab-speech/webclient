import { Component, OnInit } from '@angular/core';
import { UserService } from '../../services/user.service';
import { UserSession } from '../../models/UserSession';
import Cookies from 'js-cookie';
import { ModalService } from '../../services/modal.service';
import { environment } from '../../../environments/environment';
import { Router } from '@angular/router';
import { Role, SYSTEM_ROLE_SYS_ADMIN } from '../../models/Role';

@Component({
  selector: 'app-user',
  templateUrl: './user.component.html',
  styleUrls: ['./user.component.scss']
})
export class UserComponent implements OnInit {

  accountMenuVisible:boolean = false;
  menuTimeout:any;
  userIsSignedIn:boolean = false;
  roles:Role[] = [];

  constructor(private userService:UserService, private modalService: ModalService, private router: Router) {
  }

  ngOnInit(): void {

    this.userService.fetchSystemRoles().subscribe((roles: Role[]) => {
      this.roles = roles;
    });

    this.userService.sessionObs.subscribe((session:UserSession) => {
      this.userIsSignedIn = !!(session && session.eppn != null);
    });

    let userSession = this.userService.getSession();
    if(userSession) {
      this.userIsSignedIn = true;
    }
  }

  // Computed live on every change-detection cycle (like getUserRole()) rather than
  // latched once from a subscription, since session.system_role can arrive
  // asynchronously after this component's initial synchronous check already ran.
  isAdmin():boolean {
    return this.userService.userIsSysAdmin();
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

  /**
   * The label shown under the user's name in the account pill. This is the
   * *system* role, since project roles vary per project and there is no single
   * one to show here.
   */
  getUserRole():string {
    if(!this.userService.getSession()) {
      return 'User';
    }

    const roleName = this.userService.getSystemRoleName();
    const role = this.roles?.find(r => r.name === roleName);
    return role?.label || (roleName === SYSTEM_ROLE_SYS_ADMIN ? 'System admin' : 'User');
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

  showHelpDialog() {
    this.modalService.showModal('help-dialog');
  }

  showUseInviteCodeDialog() {
    this.accountMenuVisible = false;
    this.modalService.showModal('use-invite-code-dialog');
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
