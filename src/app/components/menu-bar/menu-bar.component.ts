import { Component, OnInit, Input } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from 'src/environments/environment';
import { SystemService } from 'src/app/services/system.service';
import { ShepherdService } from 'src/app/services/shepherd.service';

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit {

  public containerSessionViewActive:boolean = false;
  logoImagePath:string = "";
  constructor(private router: Router, private systemService: SystemService, private shepherdService: ShepherdService) {
    this.router = router;
    this.systemService = systemService;
    this.shepherdService = shepherdService;
    this.logoImagePath = environment.LOGO_IMAGE_PATH;
  }

  ngOnInit(): void {
    this.router.events.subscribe((value) => {
      if(value instanceof NavigationEnd) {
        let pathParts = value.url.split("/");
        let firstPathPart = pathParts[1];

        if(firstPathPart.indexOf("?")) {
          firstPathPart = firstPathPart.substring(0, firstPathPart.indexOf("?"));
        }

        this.containerSessionViewActive = firstPathPart == "app" || firstPathPart == "emu-webapp";
      }
    });
  }

  backButtonClicked() {
    this.router.navigate(['/']);
  }

}
