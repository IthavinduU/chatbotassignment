import { TestBed } from '@angular/core/testing';
import { ToastService } from '../services/toast.service';
import { ToastContainer } from './toast-container';

describe('ToastContainer', () => {
  let toast: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ToastContainer] });
    toast = TestBed.inject(ToastService);
  });

  it('shows each toast with its style', () => {
    toast.toasts.set([{ id: 1, text: 'Chatroom created', kind: 'success' }]);
    const fixture = TestBed.createComponent(ToastContainer);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Chatroom created');
    expect(el.querySelector('.toast-success')).not.toBeNull();
  });

  it('closes a toast when its dismiss button is clicked', () => {
    toast.toasts.set([{ id: 1, text: 'user.1 left #general', kind: 'info' }]);
    const fixture = TestBed.createComponent(ToastContainer);
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(toast.toasts().length).toBe(0);
    expect(fixture.nativeElement.querySelector('.toast')).toBeNull();
  });
});