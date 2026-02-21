import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';
import { By } from '@angular/platform-browser';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])]
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the clan list component', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges(); // Triggers change detection to render the DOM
    
    // Check if the custom element <app-clan-list> exists in the template
    const clanList = fixture.debugElement.query(By.css('app-clan-list'));
    expect(clanList).toBeTruthy();
  });

  it('should contain a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    
    const outlet = fixture.debugElement.query(By.css('router-outlet'));
    expect(outlet).toBeTruthy();
  });

  it('should have a main container with class "main"', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    
    const mainElement = fixture.debugElement.query(By.css('main.main'));
    expect(mainElement).toBeTruthy();
  });
});
