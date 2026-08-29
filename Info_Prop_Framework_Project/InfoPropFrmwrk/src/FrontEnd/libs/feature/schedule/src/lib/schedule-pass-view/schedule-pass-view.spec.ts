import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SchedulePassResult } from '@inf-prop/shared/api-client';
import {
  accumulationPassMock,
  floatLongestPassMock,
  intervalConservativePassMock,
  intervalExactPassMock,
} from '../data-access/mock-responses';
import { SchedulePassView } from './schedule-pass-view';

async function render(pass: SchedulePassResult): Promise<{
  fixture: ComponentFixture<SchedulePassView>;
  text: () => string;
}> {
  await TestBed.configureTestingModule({
    imports: [SchedulePassView],
  }).compileComponents();

  const fixture = TestBed.createComponent(SchedulePassView);
  fixture.componentRef.setInput('pass', pass);
  fixture.componentRef.setInput('kindLabel', 'Time');
  fixture.componentRef.setInput('computationTime', 0.5);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    fixture,
    text: () => fixture.nativeElement.textContent ?? '',
  };
}

describe('SchedulePassView', () => {
  it('renders the Float64 critical path and ES/LF columns for an additive pass', async () => {
    const { fixture, text } = await render(floatLongestPassMock);
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th'),
    ).map((th) => (th as HTMLElement).textContent?.trim());
    expect(headers).toContain('ES');
    expect(headers).toContain('LF');
    expect(text()).toContain('Critical path');
    // chapter mode name and margin term
    expect(text()).toContain('LongestPath');
    expect(text()).toContain('Slack');
  });

  it('surfaces a conservative enclosure honestly as a sound enclosure', async () => {
    const { fixture, text } = await render(intervalConservativePassMock);
    const banner = fixture.nativeElement.querySelector('ipf-error-banner');
    expect(banner).toBeTruthy();
    expect(text()).toContain('sound enclosure');
    expect(text()).not.toContain('over-approximation');
    // interval values are not flattened to a midpoint
    expect(text()).toContain('[9, 11]');
    // no classical schedule columns for interval
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th'),
    ).map((th) => (th as HTMLElement).textContent?.trim());
    expect(headers).not.toContain('ES');
    // necessarily vs possibly kept apart
    expect(text()).toContain('Necessarily');
    expect(text()).toContain('Possibly');
  });

  it('labels an exact interval pass as exact, not conservative', async () => {
    const { fixture, text } = await render(intervalExactPassMock);
    expect(fixture.nativeElement.querySelector('ipf-error-banner')).toBeFalsy();
    expect(text().toLowerCase()).toContain('exact float bounds');
    expect(text()).toContain('domination split');
  });

  it('renders the accumulation ranking instead of a critical path', async () => {
    const { fixture, text } = await render(accumulationPassMock);
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('th'),
    ).map((th) => (th as HTMLElement).textContent?.trim());
    expect(headers).toContain('Contribution');
    expect(headers).toContain('Rank');
    expect(text()).toContain('Accumulated total');
  });
});
