const { readFileSync } = require('fs');
const { join } = require('path');

const img = readFileSync(join(__dirname, './1680158336604.jpg'));

fetch('http://localhost:7575/test', {
	method: 'PUT',
	body: img.buffer,
});
