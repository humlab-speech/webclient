import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageBundleAssignmentDialogComponent } from './manage-bundle-assignment-dialog.component';

describe('ManageBundleAssignmentDialogComponent', () => {
  let component: ManageBundleAssignmentDialogComponent;
  let fixture: ComponentFixture<ManageBundleAssignmentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageBundleAssignmentDialogComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageBundleAssignmentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
