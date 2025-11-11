import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const indexPath = join(__dirname, 'build', 'index.js');

console.log('\n📍 Use this absolute path in your MCP configuration:\n');
console.log(indexPath);
console.log('\n');

