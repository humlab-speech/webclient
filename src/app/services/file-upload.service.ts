import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http'
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  hasPendingUploads:boolean = false;
  pendingUploads:any = [];
  statusStream:Subject<any>;

  constructor(private http:HttpClient) {
    this.statusStream = new Subject<any>();
  }

  upload(file, context:string = "", group:string = ""):Promise<string> {
    console.log("Uploading "+file.name);

    this.statusStream.next("uploads-in-progress");

    file.uploadComplete = false;
    this.hasPendingUploads = true;
    this.pendingUploads.push(file);

    return new Promise((resolve, reject) => {
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
          file.uploadComplete = true;
          if(this.isAllUploadsComplete()) {
            this.statusStream.next("all-uploads-complete");
          }
          resolve(data);
        }, error => {
          reject(error);
        });
      });
    });
  }

  cancelUpload(file) {
    for(let key in this.pendingUploads) {
      if(this.pendingUploads[key] === file) {
        this.pendingUploads.splice(key, 1);
      }
    }
    this.isAllUploadsComplete();
  }

  isAllUploadsComplete() {
    for(let key in this.pendingUploads) {
      if(this.pendingUploads[key].uploadComplete == false) {
        this.hasPendingUploads = true;
        return false;
      }
    }
    this.hasPendingUploads = false;
    return true;
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

  reset() {
    this.pendingUploads = [];
    this.hasPendingUploads = false;
  }
}
