import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-container-session-render',
  templateUrl: './container-session-render.component.html',
  styleUrls: ['./container-session-render.component.scss']
})
export class ContainerSessionRenderComponent implements OnInit {
  public token:string = "";

  constructor() {
    let token = window.location.search.substr(window.location.search.indexOf("token=")+6);
    this.token = token;
  }

  ngOnInit(): void {
    let iframe = document.getElementById("proxied-container");
    iframe.setAttribute("src", "https://app."+window.location.hostname+"?token="+this.token);
  }
}
