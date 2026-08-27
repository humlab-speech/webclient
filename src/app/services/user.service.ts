import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject, from, BehaviorSubject } from 'rxjs';
import { timeout, retry } from 'rxjs/operators';
import { UserSession } from "../models/UserSession";
import { ApiResponse } from "../models/ApiResponse";
import { environment } from 'src/environments/environment';
import { SystemService } from './system.service';
import { EventEmitter } from '@angular/core';
import { WebSocketMessage } from '../models/WebSocketMessage';
import { Role, SYSTEM_ROLE_SYS_ADMIN, SYSTEM_ROLE_USER, PROJECT_ROLE_RESEARCHER } from '../models/Role';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();
  public bootstrapLoadingStatus$: BehaviorSubject<string> = new BehaviorSubject<string>("idle");

  userIsSignedIn:boolean = false;
  getSessionUrl:string = '/api/v1/session';
  session:UserSession = null;
  //public sessionObs:Observable<UserSession>;
  public sessionObs:Subject<UserSession>;
  userAuthorizationCheckPerformed:boolean = false;
  userAuthenticationCheckPerformed:boolean = false;
  public userIsAuthenticated:boolean = false; //do we know who this user is?
  public userIsAuthorized:boolean = false; //does this user have access to the system?
  
  constructor(private http:HttpClient, private systemService:SystemService) {
    this.sessionObs = new Subject();

    // Synchronously bootstrap auth state from window.visp, which PHP populates
    // from the validated Shibboleth + MongoDB session on every page load.
    // This lets the dashboard render immediately without waiting for WebSocket
    // round-trips. The WebSocket calls below still run as a background
    // authoritative check and will update state if anything changed.
    const visp = (window as any).visp;
    if (visp?.eppn) {
      this.setUserAuthenticationStatus(true);
      if (visp.loginAllowed === true) {
        this.setAuthorizationStatus(true);
      }
    } else if (visp && ('eppn' in visp)) {
      // eppn key is present but empty — user is not authenticated
      this.setUserAuthenticationStatus(false);
    }

    this.fetchSession().subscribe((response:UserSession) => {
      this.importSession(<UserSession>response);
      if(response?.eppn) {
        this.authenticateUser(response).then((result:boolean) => {
          if(result) {
            this.authorizeUser();
          }
        });
      }
    });

    // Any command may be the one that discovers the PHP session died; when that
    // happens the signed-in UI has to come down immediately rather than linger
    // showing a dashboard whose every action fails.
    this.systemService.sessionInvalidated$.subscribe(() => {
      this.handleSessionInvalidated();
    });

    setInterval(() => {
      this.checkValidityOfPhpSessionCookie();
    }, 60000);
  }

  /**
   * Tear down every trace of the signed-in state. Guarded because a burst of
   * parallel commands will each come back denied, and re-running this per reply
   * would emit a storm of identical events at the components.
   */
  private sessionInvalidationHandled:boolean = false;

  private handleSessionInvalidated() {
    if(this.sessionInvalidationHandled) {
      return;
    }
    this.sessionInvalidationHandled = true;

    console.warn("Backend reports the session is no longer valid - signing out locally.");
    this.session = null;
    this.projectRoles = null;
    this.systemRoles = null;
    this.setUserAuthenticationStatus(false);
    this.setAuthorizationStatus(false);
    this.sessionObs.next(null);
  }

  signOut():Observable<unknown> {
    let data = { 
      cmd: "signOut",
      data: {}
    };

    return from(this.systemService.sendCommandToBackend(data));
  }
  
  redirectToAuthentication() {
    window.location.href = '/DS/Login'; //This url does not exist in the angular application, it is specified in apache as the trigger-url for shibboleth auth
  }

  async authenticateUser(sessionData:UserSession = null):Promise<boolean> {
    this.bootstrapLoadingStatus$.next("authenticateUser:start");

    try {
      const response: WebSocketMessage = await this.systemService.sendCommandToBackend({ cmd: "authenticateUser", data: sessionData || (window as any).visp });
      if (response.data.msg === "Authenticated") {
        this.setUserAuthenticationStatus(true);
        this.bootstrapLoadingStatus$.next("authenticateUser:done");
        return true;
      } else {
        this.setUserAuthenticationStatus(false);
        this.bootstrapLoadingStatus$.next("authenticateUser:error");
        return false;
      }
    } catch (error) {
      // Handle error if necessary
      this.setUserAuthenticationStatus(false);
      this.bootstrapLoadingStatus$.next("authenticateUser:error");
      return false;  // or rethrow the error depending on your needs
    }
  }

  async authorizeUser() {
    this.bootstrapLoadingStatus$.next("authorizeUser:start");

    this.systemService.sendCommandToBackend({cmd: "authorizeUser", data: {}}).then((response:WebSocketMessage) => {
      if(response.data.msg == "Authorized") {
        this.setAuthorizationStatus(true);
      }
      else {
        this.setAuthorizationStatus(false);
      }

      this.bootstrapLoadingStatus$.next("authorizeUser:done");
    }).catch((error) => {
      this.bootstrapLoadingStatus$.next("authorizeUser:error");
    });
  }

  setUserAuthenticationStatus(status) {
    //Note that authentication != authorization
    console.log("Setting user authentication status to: "+status);
    if(status) {
      this.userIsAuthenticated = true;
    }
    else {
      this.userIsAuthenticated = false;
    }
    this.userAuthenticationCheckPerformed = true;
    this.eventEmitter.emit("userAuthentication");
  }

  setAuthorizationStatus(status) {
    console.log("Setting user authorization status to: "+status);
    if(status) {
      this.userIsAuthorized = true;
    }
    else {
      this.userIsAuthorized = false;
    }
    this.userAuthorizationCheckPerformed = true;
    this.eventEmitter.emit("userAuthorization");
  }

  getUserAuthorizationStatus() {
    if(!this.userAuthorizationCheckPerformed) {
      return "not performed";
    }
    else {
      if(this.userIsAuthorized) {
        return "authorized";
      }
      else {
        return "rejected";
      }
    }
  }

  /** Invite codes are scoped to a project, so listing them requires one. */
  fetchInviteCodesByProject(projectId:string) {
    let data = {
      cmd: "getInviteCodesByProject",
      data: {
        projectId: projectId
      }
    };

    return from(this.systemService.sendCommandToBackend(data));
  }

  private projectRoles:Role[] | null = null;
  private systemRoles:Role[] | null = null;

  fetchProjectRoles():Observable<Role[]> {
    return this.fetchRoleDefinitions("getProjectRoles", () => this.projectRoles, (roles) => this.projectRoles = roles);
  }

  fetchSystemRoles():Observable<Role[]> {
    return this.fetchRoleDefinitions("getSystemRoles", () => this.systemRoles, (roles) => this.systemRoles = roles);
  }

  // A fresh { cmd, data } literal is built inside the Observable executor (not
  // reused across attempts) so that each retry gets its own requestId - reusing
  // one that was sent on a websocket connection which failed to authenticate
  // (e.g. during the initial page-load handshake) would otherwise wait forever
  // for a response that can never arrive on that dead connection.
  private fetchRoleDefinitions(cmd:string, read:() => Role[] | null, write:(roles:Role[]) => void):Observable<Role[]> {
    const cached = read();
    if (cached) {
      return from(Promise.resolve(cached));
    }
    return new Observable<Role[]>((observer) => {
      this.systemService.sendCommandToBackend({ cmd: cmd, data: {} }).then((response:WebSocketMessage) => {
        // A denial answers with an object, not an array. Caching that poisons
        // every later read for the lifetime of the page - callers do .find() on
        // what they get back - so refuse anything that is not role data and let
        // the caller retry.
        if(!Array.isArray(response.data)) {
          observer.error(new Error(cmd + " did not return a role list"));
          return;
        }
        const roles = <Role[]>response.data;
        write(roles);
        observer.next(roles);
        observer.complete();
      }).catch((error) => observer.error(error));
    }).pipe(
      timeout(5000),
      retry(3)
    );
  }

  /** True if this user is a system super user (admin panel, project creation). */
  userIsSysAdmin():boolean {
    return this.session?.system_role === SYSTEM_ROLE_SYS_ADMIN;
  }

  getSystemRoleName():string {
    return this.session?.system_role === SYSTEM_ROLE_SYS_ADMIN ? SYSTEM_ROLE_SYS_ADMIN : SYSTEM_ROLE_USER;
  }

  /**
   * Create an invite code into `projectId`. Every code must name a project and a
   * project role; `eppn` optionally locks it to one SWAMID identity.
   */
  generateInviteCode(projectId:string, role:string = PROJECT_ROLE_RESEARCHER, eppn:string = null):Observable<unknown> {

    let data = {
      cmd: "generateInviteCode",
      data: {
        projectId: projectId,
        role: role,
        eppn: eppn
      }
    };

    return from(this.systemService.sendCommandToBackend(data));
  }

  updateInviteCodes(inviteCodes:any):Observable<unknown> {
    let data = { 
      cmd: "updateInviteCodes",
      data: {
        inviteCodes: inviteCodes
      }
    };

    return from(this.systemService.sendCommandToBackend(data));
  }

  deleteInviteCode(code:string):Observable<unknown> {
    let data = { 
      cmd: "deleteInviteCode",
      data: {
        code: code
      }
    };

    return from(this.systemService.sendCommandToBackend(data));
  }


  setSession(session:UserSession) {
    this.session = session;
  }

  importSession(session:UserSession) {
    this.session = session;
    if(session?.eppn) {
      //a live session again (fresh sign-in), so re-arm the invalidation guard
      this.sessionInvalidationHandled = false;
      this.setUserAuthenticationStatus(true);
      this.setAuthorizationStatus(session.loginAllowed === true);
    }
    else {
      this.setUserAuthenticationStatus(false);
      this.setAuthorizationStatus(false);
    }
    this.sessionObs.next(this.session);
  }

  getCookie(name:string) {
    let parts = document.cookie.split(";");
    for(let i = 0; i < parts.length; i++) {
      let part = parts[i];
      if(part.indexOf(name) != -1) {
        return part.split("=")[1];
      }
    }
    return "";
  }

  fetchSession():Observable<UserSession> {
    let phpSessId = this.getCookie("PHPSESSID");
    this.bootstrapLoadingStatus$.next("getSession:start");

    return new Observable<UserSession>((observer) => {
      this.systemService.sendCommandToBackend({cmd: "getSession", data: {
        phpSessId: phpSessId
      }}).then((response:WebSocketMessage) => {
        this.setSession(<UserSession>response.data);
        this.bootstrapLoadingStatus$.next("getSession:done");
        observer.next(<UserSession>response.data);
        observer.complete();
      }).catch((error) => {
        this.bootstrapLoadingStatus$.next("getSession:error");
        observer.error(error);
      });
    });
  }

  getSession():UserSession {
    return this.session;
  }

  sessionIsAvailableLocally():boolean {
    return this.session != null;
  }

  getBundleListName() {
    return this.session.firstName.toLocaleLowerCase()+"."+this.session.lastName.toLocaleLowerCase();
  }

  /**
   * Heartbeat. The cookie merely existing proves nothing - PHP expires sessions
   * server-side at gc_maxlifetime while the cookie sits there for hours - so ask
   * the backend whether the session is actually still alive. getSession answers
   * null once it isn't, and importSession turns that into a signed-out UI.
   */
  checkValidityOfPhpSessionCookie() {
    let phpSessId = this.getCookie("PHPSESSID");
    if(phpSessId == "") {
      this.handleSessionInvalidated();
      //redirect to front page
      window.location.href = '/'
      return false;
    }

    if(this.userIsAuthenticated) {
      this.fetchSession().subscribe({
        next: (session:UserSession) => this.importSession(session),
        error: () => {} //transient socket trouble is not proof of an expired session
      });
    }

    return true;
  }
}
