import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { UserSession } from "../models/UserSession";
import { ApiResponse } from "../models/ApiResponse";
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  userIsSignedIn:boolean = false;
  getSessionUrl:string = environment.API_ENDPOINT+'/api/v1/session';
  session:UserSession = null;
  //public sessionObs:Observable<UserSession>;
  public sessionObs:Subject<UserSession>;
  
  constructor(private http:HttpClient) {

    this.sessionObs = new Subject();

    this.updateSession(true);
    setInterval(() => {
      this.updateSession();
    }, 60000);
  }

  createPersonalAccessToken():Observable<ApiResponse> {
    return this.http.get<ApiResponse>("https://"+environment.BASE_DOMAIN+"/api/v1/personalaccesstoken");
  }
  
  authenticate() {
    window.location.href = '/auth'; //This url does not exist in the application, it is specified in apache as the trigger-url for shibboleth auth
  }

  fetchSession():Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.getSessionUrl);
  }

  updateSession(createPersonalAccessToken:boolean = false) {
    return this.fetchSession().subscribe((response) => {
      if(response.code == 401) {
        this.userIsSignedIn = false;
        this.session = null;
        this.sessionObs.next(this.session);
        return;
      }
      this.session = <UserSession>response.body;
      this.sessionObs.next(this.session);
      this.userIsSignedIn = true;
      window.dispatchEvent(new Event('userSessionUpdated'));

      if(createPersonalAccessToken) {
        this.createPersonalAccessToken().subscribe();
      }
    }, (error) => {
      this.userIsSignedIn = false;
      this.session = null;
      this.sessionObs.next(this.session);
    });
  }

  setSession(session:UserSession) {
    this.session = session;
  }

  getSession():UserSession {
    return this.session;
  }

  getBundleListName() {
    return this.session.firstName.toLocaleLowerCase()+"."+this.session.lastName.toLocaleLowerCase();
  }

  searchUser(userSearchString) {
    let headers = {
      "PRIVATE-TOKEN": this.getSession().personalAccessToken
    };
    return this.http.get<any>("https://gitlab."+window.location.hostname+"/api/v4/users?search="+userSearchString, { "headers": headers })
  }
}
