import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-container-session-render',
  templateUrl: './container-session-render.component.html',
  styleUrls: ['./container-session-render.component.scss']
})
export class ContainerSessionRenderComponent implements OnInit {
  public token:string = "";
  public showLoadingIndicator:boolean = true;

  constructor() {
    let token = window.location.search.substr(window.location.search.indexOf("token=")+6);
    this.token = token;
  }

  ngOnInit(): void {
    let iframe = document.getElementById("proxied-container");

    switch(window.location.pathname) {
      case "/app":
        iframe.setAttribute("src", "https://app."+window.location.hostname+"?token="+this.token);
        break;
      case "/emu-webapp":
        let url = "https://emu-webapp."+window.location.hostname+window.location.search+"&autoConnect=true&comMode=GITLAB";
        iframe.setAttribute("src", url);
        break;
    }

    setTimeout(() => {
      this.showLoadingIndicator = false;
    }, 1000);
    
  }
}
