import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs';
import { UserSession } from "../models/UserSession";
import { ApiResponse } from "../models/ApiResponse";
import { Config } from '../config';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  userIsSignedIn:boolean = false;
  getSessionUrl:string = Config.API_ENDPOINT+'/api/v1/session';
  session:UserSession = null;
  public sessionObs:Observable<UserSession>;
  constructor(private http:HttpClient) {

    this.updateSession(true);

    setInterval(() => {
      this.updateSession();
    }, 60000);
    
  }

  createPersonalAccessToken():Observable<ApiResponse> {
    return this.http.get<ApiResponse>("https://"+Config.BASE_DOMAIN+"/api/v1/personalaccesstoken");
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
        return;
      }
      this.session = <UserSession>response.body;
      this.userIsSignedIn = true;
      window.dispatchEvent(new Event('userSessionUpdated'));

      if(createPersonalAccessToken) {
        this.createPersonalAccessToken().subscribe();
      }
    }, (error) => {
      this.userIsSignedIn = false;
      this.session = null;
    });
  }

  setSession(session:UserSession) {
    this.session = session;
  }

  getSession():UserSession {
    return this.session;
  }
}
