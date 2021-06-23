import { Injectable, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ApiResponse } from '../models/ApiResponse';
import { Config } from '../config';
import { from, Observable, Observer, Subject } from 'rxjs';

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

  constructor(private http:HttpClient) {
    console.log("System service init");
    this.initWebSocket();
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
      this.ws.close();
    }
  }

  async getEmuDb(sessionAccessCode:string) {
    this.ws.send(JSON.stringify({ cmd: "scanEmuDb", sessionAccessCode: sessionAccessCode }));

  }

  async initWebSocket() {

    if(this.wsHealthCheckInterval == null) {
      this.wsHealthCheckInterval = setInterval(() => {
        //WebSocket health check
        if(this.ws == null || this.ws.readyState == 3) {
          this.initWebSocket();
        }
      }, 2000);
    }

    return new Promise((resolve, reject) => {
      if(this.ws != null) {
        console.log("Recreating websocket");
        this.ws.close();
        this.ws = null;
      }

      const wsUrl = 'wss://'+Config.BASE_DOMAIN;
      console.log("Connecting websocket to "+wsUrl);
      this.ws = new WebSocket(wsUrl);
      this.ws.onopen = () => {
        console.log('Websocket connected');
        resolve(this.ws);
      };

      this.ws.onclose = () => {
        console.log('Websocket closed');
        this.ws.close();
        this.ws = null;
      }

      this.ws.onerror = (error) => {
        this.ws = null;
        console.log('Websocket error', error);
      }

      this.wsSubject = new Subject();

      this.ws.onmessage = (messageEvent) => {
        //console.log(messageEvent);
        this.wsSubject.next(messageEvent);
      }
    });
  }

  isGitlabReady() {
    return this.http.get<any>("/api/v1/isgitlabready");
  }
}
