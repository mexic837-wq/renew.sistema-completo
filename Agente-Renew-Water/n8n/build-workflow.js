// Genera n8n/workflow.json a partir de los .js. Uso: node n8n/build-workflow.js
const fs = require('fs'), path = require('path');
const code = f => fs.readFileSync(path.join(__dirname, f), 'utf8').replace(/^\uFEFF/, '');
const wf = {
  name: 'Agente Renew Water',
  nodes: [
    { parameters: { httpMethod: 'POST', path: 'agente-renew-sistema', responseMode: 'onReceived', options: {} },
      id: 'a1000000-0000-4000-8000-000000000001', name: 'Webhook Evolution', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [0, 0], webhookId: 'agente-renew-sistema' },
    { parameters: { assignments: { assignments: Object.entries({
        SUPABASE_URL: 'https://gateway.renewgroup.site',
        SUPABASE_SERVICE_ROLE_KEY: 'PEGA_AQUI',
        EVOLUTION_API_URL: 'https://evolutionapi.renewgroup.site',
        EVOLUTION_API_KEY: 'PEGA_AQUI',
        EVOLUTION_INSTANCE: 'RenewGroup',
        OPENROUTER_API_KEY: 'PEGA_AQUI',
        OPENROUTER_MODEL: 'anthropic/claude-haiku-5.5',
        WEBHOOK_TOKEN: 'PEGA_AQUI',
        AUTO_ADVANCE: 'true',
        BARRIDO_SEND: 'true',
        BARRIDO_SIEMPRE: 'false', // 'true' = escribe también fuera de 8:00-20:00 (para pruebas)
        SOLO_CLIENTE: '', // modo prueba: nombre o id del único cliente con el que trabaja (vacío = todos)
      }).map(([name, value], i) => ({ id: `c0000000-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`, name, value, type: 'string' })) },
      includeOtherFields: true, options: {} },
      id: 'a1000000-0000-4000-8000-000000000005', name: 'Config', type: 'n8n-nodes-base.set', typeVersion: 3.4, position: [150, 150] },
    { parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: code('comun.js') + '\n' + code('codigo-agente.js') },
      id: 'a1000000-0000-4000-8000-000000000002', name: 'Agente (WhatsApp)', type: 'n8n-nodes-base.code', typeVersion: 2, position: [450, 0] },
    { parameters: { rule: { interval: [{ field: 'hours', hoursInterval: 2 }] } },
      id: 'a1000000-0000-4000-8000-000000000003', name: 'Cada 2 horas', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, position: [0, 300] },
    { parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: code('comun.js') + '\n' + code('codigo-barrido.js') },
      id: 'a1000000-0000-4000-8000-000000000004', name: 'Barrido (perseguir encargados)', type: 'n8n-nodes-base.code', typeVersion: 2, position: [450, 300] },
  ],
  connections: {
    'Webhook Evolution': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
    'Cada 2 horas': { main: [[{ node: 'Config', type: 'main', index: 0 }]] },
    'Config': { main: [[{ node: 'Agente (WhatsApp)', type: 'main', index: 0 }, { node: 'Barrido (perseguir encargados)', type: 'main', index: 0 }]] },
    // Cada Code ignora el flujo que no le toca (return [])
  },
  active: false,
  settings: { executionOrder: 'v1' },
};
fs.writeFileSync(path.join(__dirname, 'workflow.json'), JSON.stringify(wf, null, 2));
console.log('workflow.json generado');


