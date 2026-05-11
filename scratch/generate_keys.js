const jwt = require('jsonwebtoken');

const secret = 'RenewOS_2026_Master_Key_Secret_32';

const generateKey = (role) => {
    const payload = {
        role: role,
        iss: 'supabase',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10) // 10 years
    };
    return jwt.sign(payload, secret);
};

console.log('--- NUEVAS LLAVES GENERADAS ---');
console.log('ANON_KEY:');
console.log(generateKey('anon'));
console.log('\nSERVICE_ROLE_KEY:');
console.log(generateKey('service_role'));
console.log('-------------------------------');
