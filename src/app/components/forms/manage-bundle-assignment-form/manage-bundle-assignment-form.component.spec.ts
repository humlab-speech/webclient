import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ManageBundleAssignmentFormComponent } from './manage-bundle-assignment-form.component';

describe('ManageBundleAssignmentFormComponent', () => {
  let component: ManageBundleAssignmentFormComponent;
  let fixture: ComponentFixture<ManageBundleAssignmentFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ManageBundleAssignmentFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(ManageBundleAssignmentFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
