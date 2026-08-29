import {
  buildDiamondUploadFiles,
  buildEdgesContent,
  buildLinksContent,
  buildPriorsContent,
  sanitiseNetworkName,
  scenarioFolderFor,
} from './diamond-promotion';
import { MOCK_PARENT_LINKS, MOCK_PARENT_PRIORS } from './reliability.mocks';

const base = {
  networkName: 'KarlNetwork-join-5',
  valueType: 'float64' as const,
  edgelist: [
    [2, 3],
    [2, 4],
    [3, 5],
    [4, 5],
  ] as [number, number][],
  relevantNodes: [2, 3, 4, 5],
  parentPriors: MOCK_PARENT_PRIORS,
  parentLinks: MOCK_PARENT_LINKS,
};

describe('diamond promotion — serialise a subgraph into the upload format', () => {
  it('writes an EDGES file the server will recognise', () => {
    const content = buildEdgesContent(base.edgelist);
    expect(content.split('\n')[0]).toBe('source,destination');
    expect(content).toContain('2,3');
    expect(content).toContain('4,5');
  });

  it('restricts node priors to the diamond, copying parent values verbatim', () => {
    const priors = JSON.parse(buildPriorsContent(base));
    expect(Object.keys(priors.nodes).sort()).toEqual(['2', '3', '4', '5']);
    expect(priors.nodes['9']).toBeUndefined();
    expect(priors.nodes['2']).toBe(0.9);
    expect(priors.data_type).toBe('Float64');
  });

  it('restricts link probabilities to the diamond, tolerating key spacing', () => {
    const links = JSON.parse(buildLinksContent(base));
    expect(links.links['(2,3)']).toBe(0.9);
    // parent key was "(2, 4)" with a space — still matched
    expect(links.links['(2,4)']).toBe(0.8);
    expect(links.links['(9,2)']).toBeUndefined();
  });

  it('applies a source-node prior override', () => {
    const priors = JSON.parse(
      buildPriorsContent({ ...base, priorOverrides: { 2: 0.5 } }),
    );
    expect(priors.nodes['2']).toBe(0.5);
  });

  it('produces exactly the three files /upload expects, foldered correctly', () => {
    const files = buildDiamondUploadFiles(base);
    const paths = files
      .map((f) => (f as File & { webkitRelativePath: string }).webkitRelativePath)
      .sort();
    expect(paths).toEqual([
      'KarlNetwork-join-5/KarlNetwork-join-5.EDGES',
      'KarlNetwork-join-5/float/KarlNetwork-join-5-linkprobabilities.json',
      'KarlNetwork-join-5/float/KarlNetwork-join-5-nodepriors.json',
    ]);
  });

  it('folders interval / pbox scenarios under the right keyword', () => {
    expect(scenarioFolderFor('interval')).toBe('interval');
    expect(scenarioFolderFor('pbox')).toBe('pbox');
    expect(
      buildDiamondUploadFiles({ ...base, valueType: 'interval' }).some((f) =>
        (f as File & { webkitRelativePath: string }).webkitRelativePath.includes(
          '/interval/',
        ),
      ),
    ).toBe(true);
  });

  it('sanitises a network name into a safe folder token', () => {
    expect(sanitiseNetworkName('water / Edge Bottleneck Demo')).toBe(
      'water-Edge-Bottleneck-Demo',
    );
  });
});
