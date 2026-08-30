import { TestBed } from '@angular/core/testing';
import { BulkValueEditorComponent, BulkValueItem } from './bulk-value-editor.component';

function items(n: number): BulkValueItem[] {
  return Array.from({ length: n }, (_, i) => ({
    key: String(i + 1),
    label: `Node ${i + 1}`,
  }));
}

describe('BulkValueEditorComponent', () => {
  function make(n = 3) {
    const fixture = TestBed.createComponent(BulkValueEditorComponent);
    fixture.componentRef.setInput('items', items(n));
    let emitted: Record<string, number> | null = null;
    fixture.componentInstance.changed.subscribe((v) => (emitted = v));
    fixture.detectChanges();
    return { fixture, getEmitted: () => emitted };
  }

  it('applies a bulk value to every row on "Apply to all"', () => {
    const { fixture, getEmitted } = make(3);
    const el = fixture.nativeElement as HTMLElement;

    const bulkInput = el.querySelector('.bulk-field input') as HTMLInputElement;
    bulkInput.value = '0.9';
    bulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const applyAll = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Apply to all'),
    ) as HTMLButtonElement;
    applyAll.click();
    fixture.detectChanges();

    expect(getEmitted()).toEqual({ '1': 0.9, '2': 0.9, '3': 0.9 });
  });

  it('applies a bulk value only to checked rows on "Apply to selected"', () => {
    const { fixture, getEmitted } = make(3);
    const el = fixture.nativeElement as HTMLElement;

    // check row 2 only (index 1 of the 3 row checkboxes; index 0 is "select all")
    const boxes = [...el.querySelectorAll('input[type="checkbox"]')] as HTMLInputElement[];
    boxes[2].click();
    fixture.detectChanges();

    const bulkInput = el.querySelector('.bulk-field input') as HTMLInputElement;
    bulkInput.value = '0.5';
    bulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const applySelected = [...el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Apply to selected'),
    ) as HTMLButtonElement;
    expect(applySelected.disabled).toBe(false);
    applySelected.click();
    fixture.detectChanges();

    expect(getEmitted()).toEqual({ '2': 0.5 });
  });

  it('edits one cell directly without touching the others', () => {
    const { fixture, getEmitted } = make(2);
    const el = fixture.nativeElement as HTMLElement;
    const rowInput = el.querySelector('td.v input') as HTMLInputElement;
    rowInput.value = '0.42';
    rowInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(getEmitted()).toEqual({ '1': 0.42 });
  });

  it('seeds every row with defaultValue once, on load', () => {
    const fixture = TestBed.createComponent(BulkValueEditorComponent);
    fixture.componentRef.setInput('items', items(2));
    fixture.componentRef.setInput('defaultValue', 0);
    let emitted: Record<string, number> | null = null;
    fixture.componentInstance.changed.subscribe((v) => (emitted = v));
    fixture.detectChanges();
    expect(emitted).toEqual({ '1': 0, '2': 0 });
  });

  it('paginates beyond 50 items and only shows the current page', () => {
    const { fixture } = make(120);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(50);
    expect(el.textContent).toContain('1 / 3');

    const next = [...el.querySelectorAll('.pager button')].find((b) =>
      b.getAttribute('aria-label') === 'Next page',
    ) as HTMLButtonElement;
    next.click();
    fixture.detectChanges();
    expect(el.textContent).toContain('2 / 3');
    expect(el.textContent).toContain('Node 51');
  });
});
