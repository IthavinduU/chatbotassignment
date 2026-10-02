import { TestBed } from '@angular/core/testing';
import { Logo } from './logo';

describe('Logo', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Logo] }));

  it('shows the app name', () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Fabulari');
  });

  it('has a small version for the sidebar', () => {
    const fixture = TestBed.createComponent(Logo);
    fixture.componentRef.setInput('small', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.logo').classList).toContain('logo-compact');  });
});