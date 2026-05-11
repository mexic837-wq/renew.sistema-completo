import os

filepath = r'c:\Users\LENOVO\Downloads\renew-sistema-completo-main\renew.sistema-completo-main\js\admin-app.js'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1

for i, line in enumerate(lines):
    if '// ── SYNC WITH GOOGLE CALENDAR VIA N8N ──' in line:
        start_idx = i
    if start_idx != -1 and 'console.error(\'[RENEW-GCAL] Error communicating with sync server:\', syncErr);' in line:
        # The next line should be the closing brace of the catch block
        if '}' in lines[i+1]:
            end_idx = i + 1
            break

if start_idx != -1 and end_idx != -1:
    new_logic = [
        "    // ── SYNC WITH GOOGLE CALENDAR VIA N8N ──\n",
        "    try {\n",
        "        const currentUser = JSON.parse(localStorage.getItem('rs_user')) || {};\n",
        "        fetch('https://n8n.renewgroup.site/webhook/calendario-eventos', {\n",
        "            method: 'POST',\n",
        "            headers: { 'Content-Type': 'application/json' },\n",
        "            body: JSON.stringify({ \n",
        "                action: 'create_event',\n",
        "                source: 'admin_panel',\n",
        "                user: {\n",
        "                    id: currentUser.id || 'admin',\n",
        "                    nombre: `${currentUser.nombre || ''} ${currentUser.apellido || ''}`.trim() || 'Admin',\n",
        "                    email: currentUser.email || ''\n",
        "                },\n",
        "                event: {\n",
        "                    id: nuevoEvento.id,\n",
        "                    summary: nombre,\n",
        "                    location: direccion,\n",
        "                    description: descripcion,\n",
        "                    telefono: telefono,\n",
        "                    start: fecha_inicio,\n",
        "                    end: fecha_fin || new Date(new Date(fecha_inicio).getTime() + 3600000).toISOString(),\n",
        "                    color: color,\n",
        "                    colaboradores: colaboradores,\n",
        "                    recordatorio: recordatorio\n",
        "                }\n",
        "            })\n",
        "        }).catch(e => console.error('[N8N-SYNC-ERR]', e));\n",
        "    } catch (n8nErr) {\n",
        "        console.error('[N8N-ERR]', n8nErr);\n",
        "    }\n"
    ]
    
    lines[start_idx:end_idx+1] = new_logic
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.writelines(lines)
    print("Success")
else:
    print(f"Failed to find block. start={start_idx}, end={end_idx}")
