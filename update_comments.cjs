const fs = require('fs');

let content = fs.readFileSync('src/components/IssueComments.vue', 'utf8');

content = content.replace(
  'pb-3 shrink-0">',
  'pb-2 shrink-0">'
);

content = content.replace(
  'pt-3 border-t border-ink-150',
  'pt-2 border-t border-ink-150'
);

content = content.replace(
  'border p-5 transition-all',
  'border p-4 transition-all'
);

content = content.replace(
  'mt-3.5 text-sm font-sans',
  'mt-2.5 text-sm font-sans'
);

content = content.replace(
  /min-h-\[90px\]/g,
  'min-h-[72px]'
);

fs.writeFileSync('src/components/IssueComments.vue', content);
