// Builds relay/Dashboard.html: the parent dashboard as ONE file, served by the Drive relay at <exec URL>?view=dashboard.
// Run after changing dashboard/ or www/metrics.js:  node scripts/build-dashboard.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
fs.copyFileSync(path.join(root, 'www/metrics.js'), path.join(root, 'dashboard/metrics.js'));
let html = fs.readFileSync(path.join(root, 'dashboard/index.html'), 'utf8');
for (const f of ['metrics.js', 'charts.js', 'app.js']) {
  const js = fs.readFileSync(path.join(root, 'dashboard', f), 'utf8').replace(/<\/script/gi, '<\\/script');
  html = html.replace(`<script src="${f}"></script>`, () => `<script>\n${js}\n</script>`);
}
if (/<script src=/.test(html)) throw new Error('unresolved script tag');
fs.writeFileSync(path.join(root, 'relay/Dashboard.html'), html);
console.log('relay/Dashboard.html', (html.length / 1024).toFixed(0) + ' KB');
