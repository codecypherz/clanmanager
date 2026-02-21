import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClanListComponent } from './clan-list';
import { ClashRoyaleService } from '../../service/clash-royale';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { By } from '@angular/platform-browser';

describe('ClanListComponent', () => {
  let component: ClanListComponent;
  let fixture: ComponentFixture<ClanListComponent>;

  const mockCrService = {
    getClanMembers: () => of({
      currentMemberCount: 10,
      allMembers: []
    })
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClanListComponent],
      providers: [
        { provide: ClashRoyaleService, useValue: mockCrService },
        provideNoopAnimations()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ClanListComponent);
    component = fixture.componentInstance;
  });

  it('should render data after the stream resolves', async () => {
    // Tell the fixture to watch for changes automatically
    fixture.autoDetectChanges(); 

    // Check if the service was actually called
    // (Optional: add a spy to verify this if you haven't)
    
    // Give the RxJS timer a tiny bit of "real" time to fire 
    // since it's outside a fakeAsync zone
    await new Promise(resolve => setTimeout(resolve, 10));

    // Manually trigger one last check to catch the AsyncPipe update
    fixture.detectChanges();

    const debugElement = fixture.debugElement.query(By.css('h2'));
    
    if (!debugElement) {
      // This will help us see if it's stuck on "Loading..." or "Error"
      console.log('Current HTML content:', fixture.nativeElement.innerHTML);
      throw new Error('Could not find <h2> element. See console log above for current HTML.');
    }

    expect(debugElement.nativeElement.textContent).toContain('Guinea Guns: 10/50');
  });
});
