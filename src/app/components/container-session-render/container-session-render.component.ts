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
        let url = window.location.protocol+"//emu-webapp."+window.location.hostname+window.location.search;
        iframe.setAttribute("src", url);
        break;
    }
    
  }
}
