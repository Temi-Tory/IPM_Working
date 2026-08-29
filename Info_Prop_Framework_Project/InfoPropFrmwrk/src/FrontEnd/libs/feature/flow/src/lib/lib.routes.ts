import { Route } from '@angular/router';
import { FlowWorkbenchShell } from './workbench/flow-workbench.shell';
import { FlowConfigPage } from './pages/flow-config.page';
import { FlowSummaryPage } from './pages/flow-summary.page';
import { FlowBottlenecksPage } from './pages/flow-bottlenecks.page';
import { FlowVisualizationPage } from './pages/flow-visualization.page';
import { FlowScenariosPage } from './pages/flow-scenarios.page';

/**
 * The flow/capacity workbench — one page, five sub-views, over `/flow-analysis`.
 * The shell provides the shared `FlowWorkbenchStore`, so the picked scenario and
 * the last result survive navigation between sub-views.
 */
export const featureFlowRoutes: Route[] = [
  {
    path: '',
    component: FlowWorkbenchShell,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'config' },
      { path: 'config', component: FlowConfigPage, title: 'Flow · Configure' },
      { path: 'summary', component: FlowSummaryPage, title: 'Flow · Summary' },
      {
        path: 'bottlenecks',
        component: FlowBottlenecksPage,
        title: 'Flow · Bottlenecks',
      },
      {
        path: 'visualization',
        component: FlowVisualizationPage,
        title: 'Flow · Visualization',
      },
      {
        path: 'scenarios',
        component: FlowScenariosPage,
        title: 'Flow · Scenarios',
      },
      { path: '**', redirectTo: 'config' },
    ],
  },
];
