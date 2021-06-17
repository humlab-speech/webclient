import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EmudbFormComponent } from './emudb-form.component';

describe('EmudbFormComponent', () => {
  let component: EmudbFormComponent;
  let fixture: ComponentFixture<EmudbFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ EmudbFormComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(EmudbFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
