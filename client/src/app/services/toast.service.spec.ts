import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ToastService);
  });

  it('shows a toast with its text and kind', fakeAsync(() => {
    service.show('Group settings saved', 'success');
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].text).toBe('Group settings saved');
    expect(service.toasts()[0].kind).toBe('success');
    tick(4000);
  }));

  it('removes a toast when its time runs out', fakeAsync(() => {
    service.show('user.1 joined #general', 'info', 1000);
    tick(999);
    expect(service.toasts().length).toBe(1);
    tick(1);
    expect(service.toasts().length).toBe(0);
  }));

  it('can be dismissed early', fakeAsync(() => {
    service.show('Hello');
    service.dismiss(service.toasts()[0].id);
    expect(service.toasts().length).toBe(0);
    tick(4000);
  }));
});