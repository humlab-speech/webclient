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

  constructor() { }

  async upload(file:File) {}

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
