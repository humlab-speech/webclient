import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SigninCtrlComponent } from './signin-ctrl.component';

describe('SigninCtrlComponent', () => {
  let component: SigninCtrlComponent;
  let fixture: ComponentFixture<SigninCtrlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SigninCtrlComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SigninCtrlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
