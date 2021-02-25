import { Component, OnInit } from '@angular/core';
import { InfoboxComponent } from '../infobox/infobox.component';
import { Infobox } from "../../models/Infobox";
import { UserService } from "../../services/user.service";
import { Session } from "../../models/Session";

@Component({
  selector: 'app-infobox-manager',
  templateUrl: './infobox-manager.component.html',
  styleUrls: ['./infobox-manager.component.scss']
})
export class InfoboxManagerComponent implements OnInit {

  infoboxes:Infobox[];

  userIsSignedIn:boolean = false;

  constructor(private userService:UserService) { }

  ngOnInit(): void {
    this.infoboxes = [
      {
        name: "tools-and-resources",
        title: "Tools & Resources",
        body: "hello"
      },
      {
        name: "help-and-guides",
        title: "Help & Guides",
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
      },
      {
        name: "data-management",
        title: "Data management",
        body: "Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has been the industry's standard dummy text ever since the 1500s, when an unknown printer took a galley of type and scrambled it to make a type specimen book."
      }
    ];

    /*
    this.userService.sessionObs.subscribe((session:Session) => {
      console.log("Session updated", session);
      if(session.email != null) {
        this.userIsSignedIn = true;
      }
      else {
        this.userIsSignedIn = false;
      }
    });
    */

  }

}
