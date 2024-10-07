import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalService {
  private displayModalSource = new Subject<any>();
  displayModal$ = this.displayModalSource.asObservable();

  showModal(modalName:string) {
    console.log("showing modal", modalName);
    this.displayModalSource.next({
      modalName: modalName,
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
