import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit {

  public containerSessionViewActive:boolean = false;
  logoImagePath:string = "";
  constructor(private router: Router) {
    this.router = router;
    this.logoImagePath = environment.LOGO_IMAGE_PATH;
    console.log(environment);
  }

  ngOnInit(): void {
    this.router.events.subscribe((value) => {
      if(value instanceof NavigationEnd) {
        let path = value.url.substr(0, value.url.indexOf("?"));
        this.containerSessionViewActive = path == "/app" || path == "/emu-webapp";
      }
    });
  }

  backButtonClicked() {
    this.router.navigate(['/']);
  }

}
