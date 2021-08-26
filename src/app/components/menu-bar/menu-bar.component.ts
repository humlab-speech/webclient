import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';

@Component({
  selector: 'app-menu-bar',
  templateUrl: './menu-bar.component.html',
  styleUrls: ['./menu-bar.component.scss']
})
export class MenuBarComponent implements OnInit {

  public containerSessionViewActive:boolean = false;

  constructor(private router: Router) {
    this.router = router;
  }

  ngOnInit(): void {
    this.router.events.subscribe((value) => {
      if(value instanceof NavigationEnd) {
        let path = value.url.substr(0, value.url.indexOf("?"));
        this.containerSessionViewActive = path == "/app";
      }
    });
  }

  backButtonClicked() {
    this.router.navigate(['/']);
  }

}
