import { Injectable, EventEmitter } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { ApiResponse } from '../models/ApiResponse';

@Injectable({
  providedIn: 'root'
})
export class SystemService {

  public eventEmitter: EventEmitter<any> = new EventEmitter<any>();

  gitlabIsReady:boolean = true; //Make the assumption that it is ready until it's verified that it's not, just to prevent any UI-hiccups
  gitlabIsReadyInterval:any;

  constructor(private http:HttpClient) {
  }

  isGitlabReady() {
    return this.http.get<any>("/api/v1/isgitlabready");
  }
}
