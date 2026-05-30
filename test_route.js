const http = require('http');

http.get('http://localhost:3010/api/cc-prospectos/cc_mprslscc_0', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log(`BODY: ${data}`));
}).on('error', (e) => {
  console.error(`ERROR: ${e.message}`);
});
