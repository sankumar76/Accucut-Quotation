/**
 * Prints the flight text that React's own server serialiser (the one Next uses, `react-server-dom-webpack/server.edge`) makes for the model given as the first argument (JSON), so a unit test can build a page's
 * flight data without a captured file. It must run under `node --conditions=react-server` (the serialiser refuses to load without it), which is why it is a script of its own and not an import of the test.
 */
const { createRequire } = require('node:module');

const root = createRequire(`${process.cwd()}/package.json`);
const { renderToReadableStream } = root('next/dist/compiled/react-server-dom-webpack/server.edge');

async function run() {
  const model = JSON.parse(process.argv[2] ?? 'null');
  const reader = renderToReadableStream(model, {}).getReader();
  const decoder = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += typeof value === 'string' ? value : decoder.decode(value);
  }
  process.stdout.write(text);
}

void run();
