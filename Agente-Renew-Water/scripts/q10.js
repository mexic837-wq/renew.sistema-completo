const fs=require('fs');
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split(/\r?\n/).filter(l=>l.includes('=')).map(l=>[l.split('=')[0],l.slice(l.indexOf('=')+1)]));
const H={apikey:env.EVOLUTION_API_KEY,'Content-Type':'application/json'};
(async()=>{
const num='584167717376'; // +58 0416... sin el 0 troncal
const chk=await fetch(`${env.EVOLUTION_API_URL}/chat/whatsappNumbers/${env.EVOLUTION_INSTANCE}`,{method:'POST',headers:H,body:JSON.stringify({numbers:[num]})});
console.log('existe en WhatsApp:',await chk.text());
const text='Hola Miguel 👋, soy el asistente de Renew Water. (Prueba)\n\n🆕 prueba de agente ia miguel: ¿la Aplicación de Crédito fue *aceptada* o *rechazada*? (si fue rechazada, dime el motivo)';
const r=await fetch(`${env.EVOLUTION_API_URL}/message/sendText/${env.EVOLUTION_INSTANCE}`,{method:'POST',headers:H,body:JSON.stringify({number:num,text})});
console.log('envío',r.status,(await r.text()).slice(0,200));
})();
