const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {join} = require('node:path');
const {runInNewContext} = require('node:vm');
const test = require('node:test');

const read = (path, encoding) => readFileSync(join(__dirname, '..', path), encoding);

test('standalone manifest and icon assets', () => {
  const html = read('index.html', 'utf8');
  const manifest = JSON.parse(read('manifest.webmanifest', 'utf8'));
  assert.match(html, /rel="manifest" href="manifest.webmanifest"/);
  assert.match(html, /rel="apple-touch-icon"/);
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.start_url, './');
  for (const icon of manifest.icons) {
    const png = read(icon.src);
    const [width, height] = icon.sizes.split('x').map(Number);
    assert.equal(png.readUInt32BE(16), width);
    assert.equal(png.readUInt32BE(20), height);
  }
});

test('service worker excludes navigation, private account data and offsite requests', () => {
  let fetchHandler;
  const scope = 'https://example.test/fandianjian/';
  runInNewContext(read('sw.js', 'utf8'), {
    URL,
    self: {registration:{scope},addEventListener(type, handler){if (type === 'fetch') fetchHandler=handler;}}
  });
  for (const [method, destination, url] of [
    ['GET','document',scope],
    ['GET','',scope+'api/profile'],
    ['GET','image','https://example.org/hero.webp'],
    ['POST','image',scope+'hero.webp']
  ]) {
    fetchHandler({request:{method,destination,url},respondWith(){assert.fail('private or unrelated response was intercepted');}});
  }
});
