import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FlowWorkbenchShell } from './flow-workbench.shell';

describe('FlowWorkbenchShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlowWorkbenchShell],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  it('renders the sub-view tabs', async () => {
    const fixture = TestBed.createComponent(FlowWorkbenchShell);
    fixture.detectChanges();
    await fixture.whenStable();
    const links = fixture.nativeElement.querySelectorAll('nav.tabs a');
    expect(links.length).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Configure');
    expect(fixture.nativeElement.textContent).toContain('Compare');
  });
});
