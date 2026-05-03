const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'js', 'screens', 'projectDetail.js');
let c = fs.readFileSync(filePath, 'utf8');

// Reparaciones ortográficas globales
c = c.replace(/LNEA POZO/g, 'LÍNEA POZO');
c = c.replace(/t[^\w]cnico/g, 'técnico');
c = c.replace(/DESCRIPCI[^\w]N/g, 'DESCRIPCIÓN');
c = c.replace(/Aprobaci[^\w]n/g, 'Aprobación');

// Inyectar nombres
c = c.replace(
  'const cli  = (db.Clientes_Maestro || []).find(c => c.id === deal.cliente_id) || {};',
  'const cli  = (db.Clientes_Maestro || []).find(c => c.id === deal.cliente_id) || {};' +
  '\n      const tecnicoAsignado = (db.Usuarios || []).find(u => u.id === deal.asignado_a);' +
  '\n      const tecnicoNom = tecnicoAsignado ? (tecnicoAsignado.nombre + " " + (tecnicoAsignado.apellido || "")) : "";' +
  '\n      const vendedorNom = (user.nombre || "") + " " + (user.apellido || "");' +
  '\n      const clienteNom = cli.nombre || deal.nombre_cliente || "";'
);

c = c.replace('isVendedor ? _buildFormVendedor()', 'isVendedor ? _buildFormVendedor(vendedorNom, tecnicoNom, clienteNom)');
c = c.replace('isVendedor ? _buildFormTecnico()', 'isVendedor ? _buildFormTecnico(tecnicoNom, clienteNom)');

c = c.replace('function _buildFormVendedor()', 'function _buildFormVendedor(vendedorNom = "", tecnicoNom = "", clienteNom = "")');
c = c.replace('function _buildFormTecnico()', 'function _buildFormTecnico(tecnicoNom = "", clienteNom = "")');

fs.writeFileSync(filePath, c, 'utf8');
console.log('Finalizado.');
