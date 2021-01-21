import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable } from 'rxjs';
import { Session } from "../models/Session";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  getSessionUrl:string = '/api/v1/session';
  session:Session = null;
  public sessionObs:Observable<Session>;
  constructor(private http:HttpClient) {
    this.sessionObs = new Observable((observer) => {
      this.fetchSession().subscribe((session) => {
        this.session = session;
        observer.next(this.session);
      });
    });
  }
  
  authenticate() {
    window.location.href = '/auth'; //This url does not exist in the application, it is specified in apache as the trigger-url for shibboleth auth
  }

  fetchSession():Observable<Session> {
    return this.http.get<Session>(this.getSessionUrl);
  }

  getSession():Session {
    return this.session;
  }
}
