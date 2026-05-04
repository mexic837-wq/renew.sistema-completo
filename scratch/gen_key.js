const crypto = require('crypto');

const secret = 'RenewOS_2026_Master_Key_Secret_32';

function base64url(str) {
    return Buffer.from(str).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function generateJWT(payload, secret) {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));
    
    const signature = crypto
        .createHmac('sha256', secret)
        .update(`${encodedHeader}.${encodedPayload}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    
    return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Usamos el mismo formato que tu ANON_KEY que sí funciona
const serviceRolePayload = {
    role: "service_role",
    iss: "supabase",
    iat: 1704800000,
    exp: 2528480000
};

const newServiceKey = generateJWT(serviceRolePayload, secret);
console.log('NUEVA SERVICE_ROLE_KEY:');
console.log(newServiceKey);
