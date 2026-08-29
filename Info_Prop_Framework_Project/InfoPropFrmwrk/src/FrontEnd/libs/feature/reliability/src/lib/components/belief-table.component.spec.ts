import { TestBed } from '@angular/core/testing';
import { BeliefTableComponent } from './belief-table.component';
import { BeliefRow } from '../reliability.types';

const rows: BeliefRow[] = [
  { nodeId: 1, belief: 0.9, prior: 0.9, role: 'source', roleTags: ['source'], hasDiamond: false },
  { nodeId: 5, belief: 0.7, prior: 0.9, role: 'join', roleTags: ['join'], hasDiamond: true },
  { nodeId: 3, belief: 0.81, prior: 0.9, role: 'regular', roleTags: ['regular'], hasDiamond: false },
];

describe('BeliefTableComponent', () => {
  function make() {
    const fixture = TestBed.createComponent(BeliefTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('valueType', 'float64');
    fixture.detectChanges();
    return fixture;
  }

  it('renders one row per node, node-sorted by default', () => {
    const f = make();
    const cells = (f.nativeElement as HTMLElement).querySelectorAll('tbody td.node');
    expect([...cells].map((c) => c.textContent?.trim().charAt(0))).toEqual([
      '1',
      '3',
      '5',
    ]);
  });

  it('filters to diamond joins only', () => {
    const f = make();
    const cmp = f.componentInstance as unknown as {
      toggleDiamondsOnly: () => void;
      view: () => BeliefRow[];
    };
    cmp.toggleDiamondsOnly();
    expect(cmp.view().map((r) => r.nodeId)).toEqual([5]);
  });

  it('sorts by belief (lower bound) on request', () => {
    const f = make();
    const cmp = f.componentInstance as unknown as {
      setSort: (c: 'node' | 'belief') => void;
      view: () => BeliefRow[];
    };
    cmp.setSort('belief'); // first click -> desc
    expect(cmp.view().map((r) => r.nodeId)).toEqual([1, 3, 5]);
    cmp.setSort('belief'); // toggle -> asc
    expect(cmp.view().map((r) => r.nodeId)).toEqual([5, 3, 1]);
  });
});
