const fs = require('fs');
const diff = fs.readFileSync('diff.sql', 'utf8');
const blocks = diff.split(/(?=^-- )/m);
const out = [
  '-- Filtered: CREATE TABLE + ADD COLUMN only. No MODIFY, no DROP.',
  'USE `futh_hr`;',
  'SET FOREIGN_KEY_CHECKS=0;',
  'START TRANSACTION;',
  '',
];
let creates = 0, alters = 0;

for (const b of blocks) {
  const t = b.trim();
  if (!t.startsWith('-- ')) continue;
  const type = (t.match(/^-- (\w+)/) || [])[1];
  if (!type) continue;

  if (type === 'CreateTable') {
    out.push(t);
    out.push('');
    creates++;
  } else if (type === 'AlterTable') {
    const tbl = (t.match(/ALTER TABLE `(\w+)`/) || [])[1];
    if (!tbl) continue;
    const adds = [...t.matchAll(/ADD COLUMN `[^`]+`\s+[^,;\n]+/g)].map(m => m[0].trim());
    if (!adds.length) continue;
    out.push(`ALTER TABLE \`${tbl}\` ${adds.join(', ')};`);
    out.push('');
    alters++;
  }
}
out.push('COMMIT;');
out.push('SET FOREIGN_KEY_CHECKS=1;');
fs.writeFileSync('apply_missing.sql', out.join('\n'), 'utf8');
console.log(`Wrote apply_missing.sql  (${creates} CREATE TABLE, ${alters} ADD COLUMN alters)`);