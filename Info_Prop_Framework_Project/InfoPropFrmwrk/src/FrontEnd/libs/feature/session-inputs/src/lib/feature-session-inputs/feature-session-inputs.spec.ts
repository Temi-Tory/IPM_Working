import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { NetworkStructureResponse } from '@inf-prop/shared/api-client';
import { NetworkContextService } from '@inf-prop/shared/data-access';
import { FeatureSessionInputs } from './feature-session-inputs';

function structureResponse(): NetworkStructureResponse {
  return {
    success: true,
    message: 'ok',
    endpoint: 'network-structure',
    timestamp: '2026-08-29T12:00:00',
    edges_file_path: 'Net.EDGES',
    network_structure: {
      computation_time: 0,
      total_nodes: 3,
      total_edges: 2,
      nodes: [1, 2, 3],
      edges: [
        [1, 2],
        [2, 3],
      ],
      source_nodes: [1],
      sink_nodes: [3],
      fork_nodes: [],
      join_nodes: [],
      iteration_sets: [[1], [2], [3]],
      iteration_sets_count: 3,
      ancestors: {},
      descendants: {},
      outgoing_index: {},
      incoming_index: {},
    },
  };
}

function makeRoute(kind: string): Partial<ActivatedRoute> {
  return { snapshot: { paramMap: convertToParamMap({ kind }) } as never };
}

describe('FeatureSessionInputs', () => {
  let fixture: ComponentFixture<FeatureSessionInputs>;
  let http: HttpTestingController;
  let ctx: NetworkContextService;

  async function setup(kind: string) {
    await TestBed.configureTestingModule({
      imports: [FeatureSessionInputs],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: makeRoute(kind) },
        { provide: Router, useValue: { navigateByUrl: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    ctx = TestBed.inject(NetworkContextService);
    http = TestBed.inject(HttpTestingController);
    ctx.setContext({
      sessionId: 's1',
      networkPath: 'temp_uploads/abc/Net',
      networkName: 'Net',
      edgesFilePath: 'Net.EDGES',
    });

    fixture = TestBed.createComponent(FeatureSessionInputs);
    fixture.detectChanges();
    http.expectOne('http://localhost:8080/network-structure').flush(structureResponse());
    fixture.detectChanges();
  }

  it('shows the empty state when no network is loaded', async () => {
    await TestBed.configureTestingModule({
      imports: [FeatureSessionInputs],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: makeRoute('reliability') },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(FeatureSessionInputs);
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('No network loaded');
  });

  it('gates Save until every node prior and link probability is filled, then uploads both files', async () => {
    await setup('reliability');
    const el = fixture.nativeElement as HTMLElement;

    const saveBtn = () =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Save')) as
        | HTMLButtonElement
        | undefined;
    expect(saveBtn()?.disabled).toBe(true);

    const editors = el.querySelectorAll('ipf-bulk-value-editor');
    expect(editors.length).toBe(2); // node priors + link probabilities

    // fill node priors (3 nodes) via "Apply to all"
    const nodeEditor = editors[0];
    const nodeBulkInput = nodeEditor.querySelector('.bulk-field input') as HTMLInputElement;
    nodeBulkInput.value = '0.9';
    nodeBulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      [...nodeEditor.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Apply to all'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(saveBtn()?.disabled).toBe(true); // link probs still empty

    // fill link probabilities (2 edges)
    const edgeEditor = editors[1];
    const edgeBulkInput = edgeEditor.querySelector('.bulk-field input') as HTMLInputElement;
    edgeBulkInput.value = '0.8';
    edgeBulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      [...edgeEditor.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Apply to all'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(saveBtn()?.disabled).toBe(false);
    saveBtn()?.click();
    fixture.detectChanges();

    // The exact JSON/CSV shape each file carries is covered directly (no
    // HTTP/FormData round trip involved) in `session-input-files.spec.ts`;
    // here it's enough to confirm the right set of files, under the right
    // paths, actually reaches `/upload`.
    const uploadReq = http.expectOne('http://localhost:8080/upload');
    const body = uploadReq.request.body as FormData;
    const files = body.getAll('files') as File[];
    // `UploadService` sends each file under its own `webkitRelativePath` (not
    // the short `.name`) so the server's naming convention can sort it.
    const names = files.map((f) => f.name).sort();
    // the rebuilt edges file (new network — nothing else to rebundle) + the
    // two newly-authored files, under the "float" scenario folder
    expect(names).toEqual([
      'Net/Net.EDGES',
      'Net/float/Net-linkprobabilities.json',
      'Net/float/Net-nodepriors.json',
    ]);

    uploadReq.flush({
      success: true,
      message: 'ok',
      network_path: 'temp_uploads/def/Net',
      network_name: 'Net',
      upload_id: 'def',
      files_count: 3,
      uploaded_files: [],
      edges_files: ['Net/Net.EDGES'],
    });
  });

  it('flow needs only edge capacities to save (node capacities stay optional)', async () => {
    await setup('flow');
    const el = fixture.nativeElement as HTMLElement;
    const saveBtn = () =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Save')) as
        | HTMLButtonElement
        | undefined;
    expect(saveBtn()?.disabled).toBe(true);

    const editor = el.querySelector('ipf-bulk-value-editor') as HTMLElement;
    const bulkInput = editor.querySelector('.bulk-field input') as HTMLInputElement;
    bulkInput.value = '10';
    bulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      [...editor.querySelectorAll('button')].find((b) => b.textContent?.includes('Apply to all')) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(saveBtn()?.disabled).toBe(false);
  });

  it('schedule seeds edge delays at 0, so only node durations gate Save', async () => {
    await setup('schedule');
    const el = fixture.nativeElement as HTMLElement;
    const saveBtn = () =>
      [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Save')) as
        | HTMLButtonElement
        | undefined;
    expect(saveBtn()?.disabled).toBe(true);

    const editors = el.querySelectorAll('ipf-bulk-value-editor');
    const nodeEditor = editors[0];
    const bulkInput = nodeEditor.querySelector('.bulk-field input') as HTMLInputElement;
    bulkInput.value = '5';
    bulkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    (
      [...nodeEditor.querySelectorAll('button')].find((b) =>
        b.textContent?.includes('Apply to all'),
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(saveBtn()?.disabled).toBe(false);
  });
});
