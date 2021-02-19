import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs';
import { Session } from "../models/Session";
import { ApiResponse } from "../models/ApiResponse";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  getSessionUrl:string = '/api/v1/session';
  session:Session = null;
  public sessionObs:Observable<Session>;
  constructor(private http:HttpClient) {
    
    this.sessionObs = new Observable((observer) => {
      this.fetchSession().subscribe((response) => {
        let session = <Session>response.body;
        this.session = session;
        
        this.createPersonalAccessToken().subscribe(response => {
        });

        observer.next(this.session);
      });
    });
    
  }

  createPersonalAccessToken():Observable<ApiResponse> {
    return this.http.post<ApiResponse>("/api/v1/personalaccesstoken", "{}");
  }
  
  authenticate() {
    window.location.href = '/auth'; //This url does not exist in the application, it is specified in apache as the trigger-url for shibboleth auth
  }

  fetchSession():Observable<ApiResponse> {
    return this.http.get<ApiResponse>(this.getSessionUrl);
  }

  getSession():Session {
    return this.session;
  }
}
