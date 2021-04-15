import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateEmudbFormComponent } from './create-emudb-form.component';

describe('CreateEmudbFormComponent', () => {
  let component: CreateEmudbFormComponent;
  let fixture: ComponentFixture<CreateEmudbFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ CreateEmudbFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(CreateEmudbFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
