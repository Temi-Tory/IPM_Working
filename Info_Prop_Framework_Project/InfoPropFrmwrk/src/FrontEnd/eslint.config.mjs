import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      /**
       * Module boundaries — this is what makes the parallel-track workflow safe.
       * A feature lib cannot import another feature lib; features read shared
       * only; shared/ui stays presentational (api-client types only, no
       * data-access); api-client depends on nothing but Angular.
       */
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // by layer
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:feature',
                'type:ui',
                'type:data-access',
                'type:api-client',
              ],
            },
            {
              sourceTag: 'type:feature',
              onlyDependOnLibsWithTags: [
                'type:ui',
                'type:data-access',
                'type:api-client',
              ],
            },
            {
              sourceTag: 'type:ui',
              onlyDependOnLibsWithTags: ['type:ui', 'type:api-client'],
            },
            {
              sourceTag: 'type:data-access',
              onlyDependOnLibsWithTags: ['type:data-access', 'type:api-client'],
            },
            {
              sourceTag: 'type:api-client',
              onlyDependOnLibsWithTags: [],
            },
            // by feature scope — no cross-track imports
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:app',
                'scope:shared',
                'scope:reliability',
                'scope:flow',
                'scope:schedule',
                'scope:system-profile',
                'scope:session-inputs',
              ],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: ['scope:shared'],
            },
            {
              sourceTag: 'scope:reliability',
              onlyDependOnLibsWithTags: ['scope:reliability', 'scope:shared'],
            },
            {
              sourceTag: 'scope:flow',
              onlyDependOnLibsWithTags: ['scope:flow', 'scope:shared'],
            },
            {
              sourceTag: 'scope:schedule',
              onlyDependOnLibsWithTags: ['scope:schedule', 'scope:shared'],
            },
            {
              sourceTag: 'scope:system-profile',
              onlyDependOnLibsWithTags: [
                'scope:system-profile',
                'scope:shared',
              ],
            },
            {
              sourceTag: 'scope:session-inputs',
              onlyDependOnLibsWithTags: [
                'scope:session-inputs',
                'scope:shared',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.cts', '**/*.mts'],
    rules: {},
  },
];
