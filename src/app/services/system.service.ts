import { Injectable, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { from, Observable, Observer, Subject } from 'rxjs';
import { NotifierService } from 'angular-notifier';
import { environment } from 'src/environments/environment';
import Cookies from 'js-cookie';
import { nanoid } from 'nanoid';
import { WebSocketMessage } from '../models/WebSocketMessage';

@Injectable({
  providedIn: 'root'
})
export class SystemService {

  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();
  public ws:WebSocket = null;

  public wsObservable: Observable<MessageEvent>;
  public wsSubject: Subject<MessageEvent>;
  private wsHealthCheckInterval:any = null;
  private wsError:boolean = false;
  

  constructor(private http:HttpClient, private notifierService: NotifierService) {
    this.wsSubject = new Subject<MessageEvent>();

    this.initWebSocket();
  }

  setCurrentApplication(app) {
    this.eventEmitter.emit(app);
    //set cookie
    Cookies.set('CurrentApplication', app, { domain: window.location.hostname, secure: true, sameSite: 'None' });
  }

  getCurrentApplication() {
    return Cookies.get('CurrentApplication');
  }

  async fetchOperationsSession(projectId) {
    let headers = {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    };
    let body = {
      projectId: projectId,
    };

    return new Promise((resolve, reject) => {
      this.http.post<any>('/api/v1/operations/session/please', "data="+JSON.stringify(body), { headers }).subscribe({
        next: (data) => {
          let sessionAccessCode = JSON.parse(data.body).sessionAccessCode;
          if(!sessionAccessCode) {
            this.notifierService.notify("error", "No sessionAccessCode received.");
            return;
          }
          
          let cookieParams = " SameSite=None; Secure";
          if(environment.PROTOCOL == "http") {
            cookieParams = "";
          }
          console.log("Setting SessionAccessCode cookie");
          Cookies.set('SessionAccessCode', sessionAccessCode, { domain: window.location.hostname, secure: true, sameSite: 'None' });
          console.log(document.cookie);
          resolve(sessionAccessCode);
        },
        error: (error) => {
          console.error(error);
          reject();
        }
      });
    });
    
  }

  async runCommandInOperationsSession(sessionAccessCode:string, cmd:string, env:Array<any> = []) {

    let msg = {
      appSession: sessionAccessCode,
      cmd: "route-to-ca",
      caCmd: cmd,
      env: env
    }

    return this.sendCommandToBackend(msg);
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

  async sendMessageToBackend(jsonMsg, listenerObservable = null) { //try not to use this and see sendCommandToBackend instead
    if(this.ws != null) {
      this.ws.send(jsonMsg);
    }
    else {
      console.error("sendMessageToBackend failed because there's no active websocket");
    }

    if(listenerObservable) {
      this.wsSubject.subscribe(listenerObservable);
    }
    
    /*
    let ws = <WebSocket>await this.initWebSocket();
    console.log(ws);
    ws.send(jsonMsg);
    */
    return this.ws;
  }

  sendCommandToBackendObservable(command): Observable<WebSocketMessage> {
    if(!command.requestId) {
      command.requestId = nanoid();
    }

    return new Observable((observer) => {
      //hook onto the websocket and listen for the response
      let obs = this.wsSubject.subscribe({
        next: (data:any) => {
          
          let expectedCmd = command.cmd;
          if(command.cmd == "route-to-ca") {
            expectedCmd = command.caCmd;
          }

          if(typeof data.requestId == "undefined") {
            console.warn("sendCommandToBackendObservable received return-data without requestId, the command was: "+data.cmd+", expected: "+expectedCmd);
            return;
          }

          if(data.requestId === command.requestId) {
            if(data.cmd != expectedCmd) {
              console.error("sendCommandToBackendObservable received return-data from another operation, the command was: "+data.cmd+", expected: "+expectedCmd);
              observer.error();
              return;
            }

            observer.next(data);
          }

        },
        error: (err) => {
          console.error(err);
          observer.error(err);
        }
      });
  
      if(this.ws != null && this.ws.readyState == 1) {
        this.ws.send(JSON.stringify(command));
      }
      else {
        let sendAttemptInterval = setInterval(() => {
          if(this.ws.readyState == 3) { //3 == CLOSED
            this.initWebSocket();
          }
          if(this.ws != null && this.ws.readyState == 1) {
            this.ws.send(JSON.stringify(command));
            clearInterval(sendAttemptInterval);
          }
        }, 1000);
      }

    });
  }

  async sendCommandToBackend(command): Promise<WebSocketMessage> {

    if(!command.requestId) {
      command.requestId = nanoid();
    }
    
    return new Promise((resolve, reject) => {
      //hook onto the websocket and listen for the response
      let obs = this.wsSubject.subscribe({
        next: (data:any) => {
          
          let expectedCmd = command.cmd;
          if(command.cmd == "route-to-ca") {
            expectedCmd = command.caCmd;
          }

          if(typeof data.requestId == "undefined") {
            console.warn("sendCommandToBackend received return-data without requestId, the command was: "+data.cmd+", expected: "+expectedCmd);
            return;
          }

          if(data.requestId === command.requestId) {
            if(data.cmd != expectedCmd) {
              console.error("sendCommandToBackend received return-data from another operation, the command was: "+data.cmd+", expected: "+expectedCmd);
              obs.unsubscribe();
              reject();
              return;
            }

            obs.unsubscribe();
            resolve(data);
          }

        },
        error: (err) => {
          console.error(err);
          reject(err);
        }
      });
  
      if(this.ws != null && this.ws.readyState == 1) {
        this.ws.send(JSON.stringify(command));
      }
      else {
        let sendAttemptInterval = setInterval(() => {
          if(this.ws.readyState == 3) { //3 == CLOSED
            this.initWebSocket();
          }
          if(this.ws != null && this.ws.readyState == 1) {
            this.ws.send(JSON.stringify(command));
            clearInterval(sendAttemptInterval);
          }
        }, 1000);
      }
    });
  }

  async initWebSocket() {
    return new Promise<void>((resolve, reject) => {
      let webSocketProto = "wss:";
      if(window.location.protocol == "http:") {
        webSocketProto = "ws:";
      }
      const wsUrl = webSocketProto+'//'+environment.BASE_DOMAIN;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = (event) => {
        resolve(); // Resolve the promise when the connection is open
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        //this.notifierService.notify("error", "Attempt to reconnect to backend failed.");
        reject(error); // Reject the promise on error
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket closed:', event);
        // Optionally, you can handle reconnection logic here
      };

      this.ws.onmessage = (event) => {
        this.wsSubject.next(JSON.parse(event.data));
      };
    });
  }

}
