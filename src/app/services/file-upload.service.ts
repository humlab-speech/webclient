import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpHeaders } from '@angular/common/http'
import { Subject, Subscription } from 'rxjs';
import * as JSZip from 'jszip';

@Injectable({
  providedIn: 'root'
})
export class FileUploadService {

  hasPendingUploads:boolean = false;
  zipBeforeUpload = false;
  pendingUploads:any = [];
  statusStream:Subject<any>;

  constructor(private http:HttpClient) {
    this.statusStream = new Subject<any>();
  }
  

  async upload(file, context:string = "", group:string = ""):Promise<Subscription> {
    console.log("Uploading "+file.name);

    this.statusStream.next("uploads-in-progress");

    file.uploadComplete = false;
    this.hasPendingUploads = true;
    this.pendingUploads.push(file);

    let zipBlob = null;
    if(this.zipBeforeUpload) {
      console.log("Zipping uploaded file");
      console.time("Zip complete");
      const zip = new JSZip.default();
      zip.file(file.name, file);

     zipBlob = await zip.generateAsync({
        type : "blob",
        platform: "UNIX",
        compression: "DEFLATE",
        compressionOptions: {
          level: 1
        }
      });

      console.timeEnd("Zip complete");
    }

    console.log("Uploading file");

    let formData = new FormData();
    let fileMeta = {
      filename: file.name,
      context: context,
      group: group
    };
    formData.append("fileMeta", JSON.stringify(fileMeta));
    
    if(this.zipBeforeUpload) {
      let parts = fileMeta.filename.split(".");
      parts.pop();
      fileMeta.filename = parts.join(".")+".zip";
      formData.append("fileData", zipBlob);
    }
    else {
      formData.append("fileData", file);
    }

    return this.http.post<any>("/api/v1/upload", formData).subscribe(data => {
      file.uploadComplete = true;
        if(this.isAllUploadsComplete()) {
          this.statusStream.next("all-uploads-complete");
        }
        return data;
    }, error => {
      console.error(error)
      return error;
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

  async readFile(file: File, returnAsDataUrl = true): Promise<string | ArrayBuffer> {
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

      
      if(returnAsDataUrl) {
        reader.readAsDataURL(file);
      }
      else {
        reader.readAsArrayBuffer(file);
      }
      
    });
  }

  reset() {
    this.pendingUploads = [];
    this.hasPendingUploads = false;
  }
}
