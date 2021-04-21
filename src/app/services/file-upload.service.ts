import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { Observable, Subject } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { Project } from "../models/Project";
import { ApiResponse } from "../models/ApiResponse";
import { UserService } from './user.service';
import { Config } from '../config';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  hasPendingUploads:boolean = false;
  pendingUploads:Promise<string>[] = [];

  constructor(private http:HttpClient) {
  }

  upload(file:File, context:string = "", group:string = "") {
    console.log("Uploading "+file.name);
    this.hasPendingUploads = true;
    document.dispatchEvent(new Event("pendingFormUploads"));

    this.pendingUploads.push(new Promise((resolve, reject) => {
      this.readFile(file).then(fileContents => {
        let headers = {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        };
        let body = {
          filename: file.name,
          file: fileContents,
          context: context,
          group: group
        };
        this.http.post<any>("/api/v1/upload", "data="+JSON.stringify(body), { headers }).subscribe(data => {
          this.checkAllUploadsComplete();
          resolve(data);
        }, error => {
          reject(error);
        });
      });
    }));
  }

  checkAllUploadsComplete() {
    let lastPromisesCount = this.pendingUploads.length;
    Promise.all(this.pendingUploads).then(() => {
      if(this.pendingUploads.length == lastPromisesCount) {
        this.hasPendingUploads = false;
        document.dispatchEvent(new Event("pendingFormUploadsComplete"));
      }
    });
  }

  async readFile(file: File): Promise<string | ArrayBuffer> {
    return new Promise<string | ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = e => {
        return resolve((e.target as FileReader).result);
      };

      reader.onerror = e => {
        console.error(`FileReader failed on file ${file.name}.`);
        return reject(null);
      };

      if (!file) {
        console.error('No file to read.');
        return reject(null);
      }

      reader.readAsDataURL(file);
    });
  }
}
