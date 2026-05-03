const fs = require('fs');
let c = fs.readFileSync('js/screens/clients.js', 'utf8');

const target1 = const dob = document.getElementById('quick-dob'); 
                          if(dob) { 
                              let dval = (cli.dob && cli.dob !== '-') ? cli.dob.trim() : '';;
const replacement1 = const dob = document.getElementById('quick-dob'); 
                          if(dob) { 
                              try {
                                  let dval = (cli.dob && cli.dob !== '-') ? String(cli.dob).trim() : '';;

c = c.replace(target1, replacement1);

const target2 = showToast('DB DOB: ' + cli.dob + ' | parsed: ' + dval, 'info'); dob.value = dval; 
                              dob.disabled = true; 
                          };
const replacement2 = showToast('DB DOB: ' + cli.dob + ' | parsed: ' + dval, 'info'); 
                                  dob.value = dval; 
                                  dob.disabled = true; 
                              } catch(e) {
                                  alert('DOB Error: ' + e.message);
                              }
                          };

c = c.replace(target2, replacement2);
fs.writeFileSync('js/screens/clients.js', c);
console.log('Fixed clients.js');
