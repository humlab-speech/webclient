import { Component, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})

export class AppComponent implements OnInit {
  title = environment.APPLICATION_NAME;

  showBottomBanner: boolean = true;

  private readonly toolRoutes: string[] = ['/app', '/arctic', '/octra', '/spr'];

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateBottomBannerVisibility(this.router.url);
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        this.updateBottomBannerVisibility(event.urlAfterRedirects);
      });
  }

  private updateBottomBannerVisibility(url: string): void {
    const path = url.split('?')[0];
    const isToolRoute = this.toolRoutes.some((route) => path === route || path.startsWith(route + '/'));
    this.showBottomBanner = !isToolRoute;
  }
}
