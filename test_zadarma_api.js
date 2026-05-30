const { api: z_api } = require("zadarma");

async function test() {
    try {
        console.log('Testing Zadarma API...');
        let res = await z_api({
            api_method: '/v1/pbx/record/request/',
            api_user_key: 'cd41f69ba094fd7f962e',
            api_secret_key: '43e065ae9b6e36670558',
            params: {
                pbx_call_id: 'out_5a0a507a437486d6fbe750833b8b234059649de7',
                lifetime : 7200
            }
        });
        console.log('Result:', res);
    } catch(err) {
        console.error(err);
    }
}
test();
test();
