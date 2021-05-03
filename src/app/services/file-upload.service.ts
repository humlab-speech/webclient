import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http'

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  hasPendingUploads:boolean = false;
  pendingUploads:any = [];

  constructor(private http:HttpClient) {
  }

  upload(file, context:string = "", group:string = ""):Promise<string> {
    console.log("Uploading "+file.name);
    file.uploadComplete = false;
    this.hasPendingUploads = true;
    this.pendingUploads.push(file);
    document.dispatchEvent(new Event("pendingFormUploads"));

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
          this.checkAllUploadsComplete();
          resolve(data);
        }, error => {
          reject(error);
        });
      });
    });
  }

  checkAllUploadsComplete() {
    console.log("checkAllUploadsComplete");
    for(let key in this.pendingUploads) {
      if(this.pendingUploads[key].uploadComplete == false) {
        this.hasPendingUploads = true;
        return false;
      }
    }
    this.hasPendingUploads = false;
    document.dispatchEvent(new Event("pendingFormUploadsComplete"));
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
