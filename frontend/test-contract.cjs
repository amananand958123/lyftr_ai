const fs = require('fs');
const files = [
  'src/App.tsx',
  'src/components/MessageItem.tsx',
  'src/components/MetadataBadge.tsx'
];
const requiredTestIds = [
  'chat-input',
  'send-button',
  'assistant-message',
  'meta-source',
  'meta-model',
  'meta-latency',
  'meta-input-tokens',
  'meta-output-tokens',
  'system-prompt-input'
];

let allContent = '';
files.forEach(f => { allContent += fs.readFileSync(__dirname + '/' + f, 'utf8') + '\n'; });

console.log('=== Verifying Frontend data-testid Attributes ===');
let missing = 0;
requiredTestIds.forEach(id => {
  const found = allContent.includes('data-testid="' + id + '"');
  console.log((found ? '✓' : '✗') + ' data-testid="' + id + '": ' + (found ? 'FOUND' : 'MISSING'));
  if (!found) missing++;
});

if (missing > 0) {
  console.error('FAILED: ' + missing + ' test ids missing!');
  process.exit(1);
} else {
  console.log('ALL 9 DATA-TESTID ATTRIBUTES STRICTLY COMPLIANT!');
}
