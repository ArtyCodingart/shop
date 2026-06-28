import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const workflow = await readFile(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');

const requiredSnippets = [
  'name: Deploy static site to GitHub Pages',
  'on:',
  'push:',
  'branches: [main]',
  'workflow_dispatch:',
  'pages: write',
  'id-token: write',
  'actions/configure-pages@v5',
  'actions/upload-pages-artifact@v4',
  'path: .',
  'actions/deploy-pages@v4'
];

for (const snippet of requiredSnippets) {
  if (!workflow.includes(snippet)) {
    throw new Error(`pages.yml missing ${snippet}`);
  }
}

console.log('Validated GitHub Pages workflow');
