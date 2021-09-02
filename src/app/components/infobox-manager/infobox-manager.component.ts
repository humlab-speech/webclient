import { Component, OnInit } from '@angular/core';
import { InfoboxComponent } from '../infobox/infobox.component';
import { Infobox } from "../../models/Infobox";
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-infobox-manager',
  templateUrl: './infobox-manager.component.html',
  styleUrls: ['./infobox-manager.component.scss']
})
export class InfoboxManagerComponent implements OnInit {

  infoboxes:Infobox[];

  userIsSignedIn:boolean = false;

  constructor() { }

  ngOnInit(): void {

    this.infoboxes = [
      {
        name: "data-management",
        title: "Data management",
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
      },
      {
        name: "help-and-guides",
        title: "Help & Guides",
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
      }
    ];

    if(environment.ENABLED_APPLICATIONS.includes("octra") || environment.ENABLED_APPLICATIONS.includes("labjs")) {
      this.infoboxes.push({
        name: "tools-and-resources",
        title: "Tools & Resources",
        body: "hello"
      });
    }

  }

}
