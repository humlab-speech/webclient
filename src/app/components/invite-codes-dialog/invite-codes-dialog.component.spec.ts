import { ComponentFixture, TestBed } from '@angular/core/testing';

import { InviteCodesDialogComponent } from './invite-codes-dialog.component';

describe('InviteCodesDialogComponent', () => {
  let component: InviteCodesDialogComponent;
  let fixture: ComponentFixture<InviteCodesDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ InviteCodesDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(InviteCodesDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
