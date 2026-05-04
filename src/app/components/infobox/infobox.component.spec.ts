import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ModalService } from 'src/app/services/modal.service';
import { UserService } from 'src/app/services/user.service';

import { InfoboxComponent } from './infobox.component';

describe('InfoboxComponent', () => {
  let component: InfoboxComponent;
  let fixture: ComponentFixture<InfoboxComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InfoboxComponent ],
      schemas: [NO_ERRORS_SCHEMA],
      providers: [
        {
          provide: UserService,
          useValue: {
            getSession: () => null,
            sessionObs: new Subject()
          }
        },
        {
          provide: ModalService,
          useValue: { showModal: jasmine.createSpy('showModal') }
        }
      ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InfoboxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
