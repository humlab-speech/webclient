import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject, from } from 'rxjs';
import { UserSession } from "../models/UserSession";
import { ApiResponse } from "../models/ApiResponse";
import { environment } from 'src/environments/environment';
import { SystemService } from './system.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  userIsSignedIn:boolean = false;
  getSessionUrl:string = '/api/v1/session';
  session:UserSession = null;
  //public sessionObs:Observable<UserSession>;
  public sessionObs:Subject<UserSession>;
  
  constructor(private http:HttpClient, private systemService:SystemService) {
    this.sessionObs = new Subject();
  }
  
  authenticate() {
    window.location.href = '/DS/Login'; //This url does not exist in the application, it is specified in apache as the trigger-url for shibboleth auth
  }

  fetchSession():Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.getSessionUrl);
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

  getSession():UserSession {
    if(this.session == null) {
      this.fetchSession().subscribe((response:ApiResponse) => {
        this.session = <UserSession>response.body;
      });
    }

    return this.session;
  }

  getBundleListName() {
    return this.session.firstName.toLocaleLowerCase()+"."+this.session.lastName.toLocaleLowerCase();
  }
}
