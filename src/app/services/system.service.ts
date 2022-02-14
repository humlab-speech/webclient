import { Injectable, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { from, Observable, Observer, Subject } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { UserService } from './user.service';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class SystemService {

  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();
  public ws:WebSocket = null;

  gitlabIsReady:boolean = true; //Make the assumption that it is ready until it's verified that it's not, just to prevent any UI-hiccups
  gitlabIsReadyInterval:any;

  public wsObservable: Observable<MessageEvent>;
  public wsSubject: Subject<MessageEvent>;
  private wsHealthCheckInterval:any = null;
  private wsError:boolean = false;
  userAuthenticationPerformed:boolean = false;
  public userIsAuthenticated:boolean = false;

  constructor(private http:HttpClient, private notifierService: NotifierService, private userService: UserService) {
    console.log("System service init");

    window.addEventListener('userSessionUpdated', () => {
      if(this.ws == null) {
        this.initWebSocket().then(() => {
          //this.ws.send(JSON.stringify({ cmd: "accessListCheck", username: "" }));
        });
      }
    });

    this.isGitlabReady();
  }

  fetchOperationsSession(userSession:Object, project:Object): Observable<MessageEvent>{
    this.initWebSocket().then((ws:WebSocket) => {
      ws.send(JSON.stringify({ cmd: "fetchOperationsSession", user: userSession, project: project }));
    });
    return this.wsObservable;
  }

  shutdownOperationsSession(sessionAccessCode:string) {
    if(sessionAccessCode == null || sessionAccessCode.length < 1) {
      console.log("No session to shutdown");
      return;
    }
    if(this.ws && this.ws.readyState == 1) {
      this.ws.send(JSON.stringify({ cmd: "shutdownOperationsSession",  sessionAccessCode: sessionAccessCode }));
      //this.ws.close();
    }
  }

  async initWebSocket() {
    if(this.wsHealthCheckInterval == null) {
      this.wsHealthCheckInterval = setInterval(() => {
        //WebSocket health check
        if(this.ws == null || this.ws.readyState == 3) {
          this.initWebSocket();
        }
      }, 10000);
    }

    return new Promise((resolve, reject) => {
      if(!this.userService.userIsSignedIn) {
        resolve(null);
      }

      if(this.ws != null) {
        console.log("Recreating websocket");
        this.ws.close();
        this.ws = null;
      }

      const wsUrl = 'wss://'+environment.BASE_DOMAIN;
      console.log("Connecting websocket to "+wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        console.log('Websocket connected');
        if(this.wsError) {
          this.wsError = false;
          //this.notifierService.notify("info", "Connection to backend reestablished.");
        }
        resolve(this.ws);
      };

      this.ws.onclose = () => {
        this.ws.close();
        this.ws = null;
        console.log('Websocket closed');
      }

      this.ws.onerror = (error) => {
        this.ws = null;
        if(this.wsError) {
          this.notifierService.notify("error", "Attempt to reconnect to backend failed.");
        }
        else {
          //this.notifierService.notify("error", "Lost connection to backend.");
          this.wsError = true;
        }
        console.log('Websocket error', error);
      }

      this.wsSubject = new Subject();

      this.ws.onmessage = (messageEvent) => {
        //console.log(JSON.parse(messageEvent.data));
        let msg = JSON.parse(messageEvent.data);

        if(msg.type == "authentication-status") {
          if(msg.message) {
            //User is authenticated'
            /*
            this.notifierService.notify("info", "You are in the access list");
            console.log("You are in the access list");
            */
            this.userIsAuthenticated = true;
            
          }
          else {
            //User failed authentication
            /*
            this.notifierService.notify("warning", "You are not in the access list");
            console.log("You are not in the access list");
            */
            this.userIsAuthenticated = false;
          }
          this.userAuthenticationPerformed = true;
          this.eventEmitter.emit("userAuthentication");
        }

        /*
        console.log(JSON.parse(messageEvent.data));
        const pkt = JSON.parse(messageEvent.data);
        if(pkt.type == "status-update" && pkt.message == 'Authentication failed') {
          console.log('close ws');
          this.ws.close();
        }
        */
        this.wsSubject.next(messageEvent);
      }
    });
  }

  getUserAuthenticationStatus() {
    if(!this.userAuthenticationPerformed) {
      return "not performed";
    }
    else {
      if(this.userIsAuthenticated) {
        return "authenticated";
      }
      else {
        return "rejected";
      }
    }
    
  }

  async isGitlabReady() {
    this.gitlabIsReadyInterval = setInterval(() => {
      this.gitlabReadyCheck();
    }, 5000);
    this.gitlabReadyCheck();
  }

  gitlabReadyCheck() {
    this.http.get<any>("/api/v1/isgitlabready").subscribe(msg => {
      this.gitlabIsReady = msg.body.gitlabIsReady;
      if(msg.body.gitlabIsReady) {
        clearInterval(this.gitlabIsReadyInterval);
        console.log("gitlabIsReady");
        this.eventEmitter.emit("gitlabIsReady");
      }
      else {
        console.log("gitlabIsNotReady");
        this.eventEmitter.emit("gitlabIsNotReady");
      }
    });
  }
}
