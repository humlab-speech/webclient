import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageSessionsDialogComponent } from './manage-sessions-dialog.component';

describe('ManageSessionsDialogComponent', () => {
  let component: ManageSessionsDialogComponent;
  let fixture: ComponentFixture<ManageSessionsDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageSessionsDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageSessionsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
