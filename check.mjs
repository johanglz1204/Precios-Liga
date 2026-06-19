import fs from 'fs';
const code = fs.readFileSync('src/components/Dashboard.jsx', 'utf-8');
const tags = [];
const regex = /<\/?([a-zA-Z0-9]+)[^>]*>/g;
let match;
while ((match = regex.exec(code)) !== null) {
  const fullTag = match[0];
  if (fullTag.includes('=>') || fullTag.includes('=')) continue; // ignore arrow functions inside JSX braces that might match regex
  const tagName = match[1];
  if (fullTag.startsWith('</')) {
    if (tags.length > 0 && tags[tags.length - 1].tag === tagName) {
      tags.pop();
    } else {
      console.log('Mismatch closing:', fullTag, 'at index', match.index, 'expected', tags[tags.length - 1]?.tag);
      break;
    }
  } else if (!fullTag.endsWith('/>')) {
    tags.push({ tag: tagName, index: match.index });
  }
}
console.log('Unclosed tags:', tags.map(t => t.tag));
