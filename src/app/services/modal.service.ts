import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private displayModalSource = new Subject<any>();
  displayModal$ = this.displayModalSource.asObservable();
  public currentNav = '';

  setCurrentNavigation(nav:string) {
    this.currentNav = nav;
    console.log("currentNav", this.currentNav);
  }

  getCurrentNavigation() {
    return this.currentNav;
  }

  showModal(modalName:string, ...args: any[]) {
    this.displayModalSource.next({
      modalName: modalName,
      args: args,
      active: true
    });
  }

  hideModal(modalName:string) {
    console.log("hiding modal");
    this.displayModalSource.next({
      modalName: modalName,
      active: false
    });
  }

}
