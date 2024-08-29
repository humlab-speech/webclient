import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject, from } from 'rxjs';
import { UserSession } from "../models/UserSession";
import { ApiResponse } from "../models/ApiResponse";
import { environment } from 'src/environments/environment';
import { SystemService } from './system.service';
import { EventEmitter } from '@angular/core';
import { WebSocketMessage } from '../models/WebSocketMessage';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();

  userIsSignedIn:boolean = false;
  getSessionUrl:string = '/api/v1/session';
  session:UserSession = null;
  //public sessionObs:Observable<UserSession>;
  public sessionObs:Subject<UserSession>;
  userAuthorizationPerformed:boolean = false;
  public userIsAuthenticated:boolean = false; //do we know who this user is?
  public userIsAuthorized:boolean = false; //does this user have access to the system?
  
  constructor(private http:HttpClient, private systemService:SystemService) {
    this.sessionObs = new Subject();
    this.authenticateUser();
    this.authorizeUser();

    this.fetchSession().subscribe((response:UserSession) => {
      this.importSession(<UserSession>response);
    });
  }

  signOut():Observable<unknown> {
    let data = { 
      cmd: "signOut",
      data: {}
    };

    return from(this.systemService.sendCommandToBackend(data));
  }
  
  redirectToAuthentication() {
    window.location.href = '/DS/Login'; //This url does not exist in the application, it is specified in apache as the trigger-url for shibboleth auth
  }

  async authenticateUser() {
    this.systemService.sendCommandToBackend({cmd: "authenticateUser", data: {}}).then((response:WebSocketMessage) => {
      if(response.data.msg == "Authenticated") {
        this.setUserAuthenticationStatus(true);
      }
      else {
        this.setUserAuthenticationStatus(false);
      }
    });

  }

  async authorizeUser() {
    this.systemService.sendCommandToBackend({cmd: "authorizeUser", data: {}}).then((response:WebSocketMessage) => {
      if(response.data.msg == "Authorized") {
        this.setAuthorizationStatus(true);
      }
      else {
        this.setAuthorizationStatus(false);
      }
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
    this.eventEmitter.emit("userAuthorization");
  }

  getUserAuthorizationStatus() {
    if(!this.userAuthorizationPerformed) {
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

  fetchInviteCodesByUser() {
    let data = { 
      cmd: "getInviteCodesByUser",
      data: {}
    };

    return from(this.systemService.sendCommandToBackend(data));
  }

  generateInviteCode(projectId:string = ""):Observable<unknown> {

    let data = { 
      cmd: "generateInviteCode",
      data: {
        projectId: projectId
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

    return new Observable<UserSession>((observer) => {
      this.systemService.sendCommandToBackend({cmd: "getSession", data: {
        phpSessId: phpSessId
      }}).then((response:WebSocketMessage) => {
        observer.next(<UserSession>response.data);
        observer.complete();
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
}
