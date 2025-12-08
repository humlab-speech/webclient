import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import Cookies from 'js-cookie';
import { SystemService } from 'src/app/services/system.service';

@Component({
  selector: 'app-container-session-render',
  templateUrl: './container-session-render.component.html',
  styleUrls: ['./container-session-render.component.scss']
})
export class ContainerSessionRenderComponent implements OnInit {
  public token:string = "";
  public showLoadingIndicator:boolean = true;
  private modalService: ModalService;
  public modalActive:boolean = false;
  public modalName:string = "";
  public modalArgs:any[] = [];

  constructor(modalService: ModalService, private systemService: SystemService) {
    this.modalService = modalService;
    let token = window.location.search.substr(window.location.search.indexOf("token=")+6);
    this.token = token;
    this.systemService = systemService;
  }

  ngOnInit(): void {
    let iframe = document.getElementById("proxied-container");
    
    iframe.onload = () => {
      setTimeout(() => {
        this.showLoadingIndicator = false;
      }, 500);
    }

    console.log(window.location.protocol+"//app."+window.location.hostname+"?token="+this.token);

    switch(window.location.pathname) {
      case "/app":
        iframe.setAttribute("src", window.location.protocol+"//app."+window.location.hostname+"?token="+this.token);
        break;
      case "/emu-webapp":
        let emuWebAppUrl = window.location.protocol+"//emu-webapp."+window.location.hostname+window.location.search;
        iframe.setAttribute("src", emuWebAppUrl);
        break;
      case "/octra":
        this.setupOctra(iframe);
        break;
    }

    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
      this.modalArgs = modal.args || [];
    });
  }

  setupOctra(iframe) {
    const DEBUG = false;

    let octraTask = Cookies.get("octraTask");
    if (DEBUG) console.log("Octra task from cookie:", octraTask);
    let octraTaskAnnotationFile = Cookies.get("octraTaskAnnotationFile");
    if (DEBUG) console.log("Octra task annotation file from cookie:", octraTaskAnnotationFile);

    // Use current origin so this works across domains/environments, including ports
    const apiBase = window.location.protocol + "//octra." + window.location.host;
    const taskUrl = `${apiBase}/api/v1/file/download/${octraTask}`;
    if (!octraTask) {
      console.warn('Octra task not found in cookies; download URL will be invalid.');
    }
    let octraUrlParams = `?embedded=true&audio_url=${encodeURIComponent(taskUrl)}.wav`;
    if(octraTaskAnnotationFile) {
      octraUrlParams += `&transcript=${encodeURIComponent(taskUrl)}_annot.json`;
    }
    let octraUrl = window.location.protocol+"//octra."+window.location.hostname + octraUrlParams;

    iframe.setAttribute("src", octraUrl);

    interface OctraWindowMessageEventData {
      status?: "success" | "changed" | "error";
      data?: {
        annotation: IFile; // IFile with annotation saved as AnnotJSON.
      }
      error?: string; // only set on error
    }

    interface IFile {
      name: string;
      content: string;
      type: string;
      encoding: string;
    }
    
    window.addEventListener("message", (event) => {
      const octraMessageData: OctraWindowMessageEventData = event.data;

      if (octraMessageData?.status === "error" && octraMessageData?.error) {
        // something went wrong
        const error = octraMessageData.error;
        console.log("Octra error:", error);
      } else if (octraMessageData?.status === "success") {
          // user clicked on "SAVE" button on the bottom
          const annotation = octraMessageData.data.annotation; // annotJSON
          if (DEBUG) console.log("Octra annotation saved:", annotation);

          const annotationParsed = JSON.parse(annotation.content);

          this.systemService.sendCommandToBackend({
            cmd: "saveOctraTask",
            octraTaskId: annotationParsed.name,
            annotation: annotationParsed
          }).then((response: any) => {
            if (DEBUG) console.log('Task updated:', response);
          });

        } else if (octraMessageData?.status === "changed") {
          // user changed something in Octra
          const annotation = octraMessageData.data.annotation; // annotJSON
          if (DEBUG) console.log("Octra annotation changed:", annotation);
        }
    });
  }



  openModal() {
    console.log("Opening modal");
    this.modalService.showModal("invite-codes-dialog");
  }
  
}
