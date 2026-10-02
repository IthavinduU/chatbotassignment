import { TestBed } from '@angular/core/testing';
import { SERVER_URL } from '../core/config';
import { Avatar } from './avatar';

describe('Avatar', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [Avatar] }));

  it('shows the first letter of the username when there is no picture', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('username', 'groupadmin');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.avatar-letter')?.textContent?.trim()).toBe('G');
    expect(el.querySelector('img')).toBeNull();
  });

  it('shows the profile picture from the server', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('username', 'user.1');
    fixture.componentRef.setInput('avatarUrl', '/uploads/me.png');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('img').getAttribute('src')).toBe(`${SERVER_URL}/uploads/me.png`);
  });

  it('uses the requested size', () => {
    const fixture = TestBed.createComponent(Avatar);
    fixture.componentRef.setInput('username', 'user2');
    fixture.componentRef.setInput('size', 48);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.avatar').style.width).toBe('50px');  });
});