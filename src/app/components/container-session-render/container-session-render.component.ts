import { Component, OnInit } from '@angular/core';
import { ModalService } from '../../services/modal.service';
import Cookies from 'js-cookie';
import { trattOrigin } from 'src/app/models/TrattUrl';
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
      case "/artic":
        let emuWebAppUrl = window.location.protocol+"//artic."+window.location.hostname+window.location.search;
        iframe.setAttribute("src", emuWebAppUrl);
        break;
      case "/tratt":
        this.setupTratt(iframe);
        break;
    }

    this.modalService.displayModal$.subscribe(modal => {
      this.modalActive = modal.active;
      this.modalName = modal.modalName;
      this.modalArgs = modal.args || [];
    });
  }

  /**
   * TRATT's VISP workspace: the user's bundle list in the project, transcribed
   * into the level chosen in the launch dialog. TRATT reads and saves through
   * the annotation server (as artic does), authenticated by the PHPSESSID and
   * projectId cookies; the server address comes from TRATT's own config.
   */
  setupTratt(iframe) {
    const launch = new URLSearchParams(window.location.search);
    const projectId = launch.get("projectId") || Cookies.get("projectId") || "";
    const query = new URLSearchParams({
      workspace: "visp",
      projectId: projectId,
      level: launch.get("level") || "",
    });
    iframe.setAttribute("src", trattOrigin() + "/?" + query.toString());
  }

  openModal() {
    console.log("Opening modal");
    this.modalService.showModal("invite-codes-dialog");
  }
  
}
