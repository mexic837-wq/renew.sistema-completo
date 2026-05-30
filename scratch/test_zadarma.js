const crypto = require('crypto');

const ZADARMA_KEY = 'cd41f69ba094fd7f962e';
const ZADARMA_SECRET = '43e065ae9b6e36670558';

const querystring = require('querystring');

function generateZadarmaSignature(method, params) {
    const sortedKeys = Object.keys(params).sort();
    const sortedParams = {};
    sortedKeys.forEach(k => { sortedParams[k] = params[k]; });
    
    // RFC1738 encoding using querystring
    const queryString = querystring.stringify(sortedParams);

    const md5 = crypto.createHash('md5').update(queryString).digest('hex');
    const data = method + queryString + md5;
    const hmacHex = crypto.createHmac('sha1', ZADARMA_SECRET).update(data).digest('hex');
    const signature = Buffer.from(hmacHex).toString('base64');
    
    return { queryString, signature };
}

async function testCall() {
    const params = { from: '100', to: '+5804241601592' };
    const method = '/v1/request/callback/';
    const { queryString, signature } = generateZadarmaSignature(method, params);

    const url = `https://api.zadarma.com${method}?${queryString}`;
    console.log('Requesting:', url);
    console.log('Auth Header:', `${ZADARMA_KEY}:${signature}`);

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `${ZADARMA_KEY}:${signature}`
        }
    });
    
    const text = await res.text();
    console.log('Response:', res.status, text);
}

testCall();
