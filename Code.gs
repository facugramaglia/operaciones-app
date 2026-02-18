// ═══════════════════════════════════════════════════════════════════
//  Google Apps Script — Sistema de Operaciones de Cambio
//  Pegá este código en: script.google.com → tu proyecto → Code.gs
//  Luego: Implementar → Nueva implementación → Aplicación web
//         Ejecutar como: Yo   |   Acceso: Cualquiera
// ═══════════════════════════════════════════════════════════════════

function doGet(e) {
  try {
    const action = e.parameter.action;
    let result;

    switch (action) {
      case 'add_operation':        result = addOperation(e.parameter);       break;
      case 'update_status':        result = updateStatus(e.parameter);       break;
      case 'edit_operation':       result = editOperation(e.parameter);      break;
      case 'add_deuda':            result = addDeuda(e.parameter);           break;
      case 'update_deuda_status':  result = updateDeudaStatus(e.parameter);  break;
      case 'edit_deuda':           result = editDeuda(e.parameter);          break;
      default:
        result = { success: false, error: 'Acción desconocida: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}


// ───────────────────────────────────────────────────────────────────
//  VENTAS / COMPRAS
// ───────────────────────────────────────────────────────────────────

/**
 * Agrega una fila nueva a VENTAS o COMPRAS.
 * Params: tipo, fecha (yyyy-mm-dd o dd/mm/yyyy), operador, cliente,
 *         cantidad, precio, total, observaciones
 */
function addOperation(p) {
  const sheetName = p.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = getSheet(sheetName);

  sheet.appendRow([
    normalizarFecha(p.fecha),        // A: Fecha
    p.operador || '',                // B: Operador
    p.cliente  || '',                // C: Cliente
    toNum(p.cantidad),               // D: Cantidad USD
    toNum(p.precio),                 // E: Precio ARS
    toNum(p.total),                  // F: Total ARS
    'PENDIENTE',                     // G: Estado
    p.observaciones || '',           // H: Observaciones
    '', '', '',                      // I J K: reservado
    '',                              // L: Modificado Por
    ''                               // M: Fecha Modificación
  ]);

  return { success: true, action: 'add_operation', tipo: p.tipo };
}

/**
 * Cambia el estado de una operación (VENTAS o COMPRAS).
 * Params: tipo, fecha (dd/mm/yyyy), cliente, cantidad, nuevoEstado, usuario
 */
function updateStatus(p) {
  const sheetName = p.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();

  const fecha    = String(p.fecha    || '').trim();
  const cliente  = String(p.cliente  || '').trim();
  const cantidad = String(p.cantidad || '').replace(/[$,]/g, '').trim();

  for (let i = 1; i < data.length; i++) {
    if (matchOp(data[i], fecha, cliente, cantidad)) {
      sheet.getRange(i + 1, 7).setValue(p.nuevoEstado);     // G: Estado
      sheet.getRange(i + 1, 12).setValue(p.usuario || '');  // L: Modificado Por
      sheet.getRange(i + 1, 13).setValue(ahora());           // M: Fecha Mod
      return { success: true, row: i + 1 };
    }
  }
  return { success: false, error: 'Fila no encontrada', fecha, cliente, cantidad };
}

/**
 * Edita cantidad, precio, total y observaciones de una operación.
 * Params: tipo, fecha, clienteOriginal, cantidadOriginal,
 *         nuevaCantidad, nuevoPrecio, nuevoTotal, nuevasObs, usuario
 */
function editOperation(p) {
  const sheetName = p.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = getSheet(sheetName);
  const data  = sheet.getDataRange().getValues();

  const fecha    = String(p.fecha            || '').trim();
  const cliente  = String(p.clienteOriginal  || '').trim();
  const cantidad = String(p.cantidadOriginal || '').replace(/[$,]/g, '').trim();

  for (let i = 1; i < data.length; i++) {
    if (matchOp(data[i], fecha, cliente, cantidad)) {
      const nc = toNum(p.nuevaCantidad);
      const np = toNum(p.nuevoPrecio);
      const nt = toNum(p.nuevoTotal) || nc * np;
      sheet.getRange(i + 1, 4).setValue(nc);              // D: Cantidad
      sheet.getRange(i + 1, 5).setValue(np);              // E: Precio
      sheet.getRange(i + 1, 6).setValue(nt);              // F: Total
      sheet.getRange(i + 1, 8).setValue(p.nuevasObs || ''); // H: Obs
      sheet.getRange(i + 1, 12).setValue(p.usuario || '');  // L: Modificado Por
      sheet.getRange(i + 1, 13).setValue(ahora());           // M: Fecha Mod
      return { success: true, row: i + 1 };
    }
  }
  return { success: false, error: 'Fila no encontrada', fecha, cliente };
}


// ───────────────────────────────────────────────────────────────────
//  DEUDAS
//  Estructura hoja DEUDAS:
//  A=Fecha  B=Cliente  C=Monto  D=Moneda  E=Estado
//  F=Observaciones  G=Creado Por  H=Fecha Creación
//  I=Cobrado Por  J=Fecha Cobro
// ───────────────────────────────────────────────────────────────────

/**
 * Agrega una nueva deuda.
 * Params: fecha, cliente, monto, moneda, observaciones, creadoPor
 */
function addDeuda(p) {
  const sheet = getOrCreateDeudas();

  sheet.appendRow([
    normalizarFecha(p.fecha),       // A: Fecha
    p.cliente      || '',           // B: Cliente
    toNum(p.monto),                 // C: Monto
    p.moneda       || 'USD',        // D: Moneda
    'PENDIENTE',                    // E: Estado
    p.observaciones || '',          // F: Observaciones
    p.creadoPor    || '',           // G: Creado Por
    ahora(),                        // H: Fecha Creación
    '',                             // I: Cobrado Por
    ''                              // J: Fecha Cobro
  ]);

  return { success: true, action: 'add_deuda' };
}

/**
 * Cambia el estado de una deuda (PENDIENTE ↔ COBRADA).
 * Params: fecha, cliente, monto, nuevoEstado, usuario
 */
function updateDeudaStatus(p) {
  const sheet = getSheet('DEUDAS');
  const data  = sheet.getDataRange().getValues();

  const fecha   = String(p.fecha   || '').trim();
  const cliente = String(p.cliente || '').trim();
  const monto   = String(p.monto   || '').replace(/[$,]/g, '').trim();

  for (let i = 1; i < data.length; i++) {
    if (matchDeuda(data[i], fecha, cliente, monto)) {
      sheet.getRange(i + 1, 5).setValue(p.nuevoEstado); // E: Estado
      if (p.nuevoEstado === 'COBRADA') {
        sheet.getRange(i + 1, 9).setValue(p.usuario || ''); // I: Cobrado Por
        sheet.getRange(i + 1, 10).setValue(ahora());         // J: Fecha Cobro
      } else {
        // Vuelve a PENDIENTE → limpiar campos de cobro
        sheet.getRange(i + 1, 9).setValue('');
        sheet.getRange(i + 1, 10).setValue('');
      }
      return { success: true, row: i + 1 };
    }
  }
  return { success: false, error: 'Deuda no encontrada', fecha, cliente, monto };
}

/**
 * Edita fecha, cliente, monto, moneda y observaciones de una deuda.
 * Params: fechaOriginal, clienteOriginal, montoOriginal,
 *         nuevaFecha, nuevoCliente, nuevoMonto, nuevaMoneda, nuevasObs, usuario
 */
function editDeuda(p) {
  const sheet = getSheet('DEUDAS');
  const data  = sheet.getDataRange().getValues();

  const fechaOrig   = String(p.fechaOriginal   || '').trim();
  const clienteOrig = String(p.clienteOriginal || '').trim();
  const montoOrig   = String(p.montoOriginal   || '').replace(/[$,]/g, '').trim();

  for (let i = 1; i < data.length; i++) {
    if (matchDeuda(data[i], fechaOrig, clienteOrig, montoOrig)) {
      sheet.getRange(i + 1, 1).setValue(normalizarFecha(p.nuevaFecha) || fechaOrig); // A
      sheet.getRange(i + 1, 2).setValue(p.nuevoCliente || clienteOrig);              // B
      sheet.getRange(i + 1, 3).setValue(toNum(p.nuevoMonto) || toNum(montoOrig));   // C
      sheet.getRange(i + 1, 4).setValue(p.nuevaMoneda || data[i][3]);               // D
      sheet.getRange(i + 1, 6).setValue(p.nuevasObs || '');                         // F
      return { success: true, row: i + 1 };
    }
  }
  return { success: false, error: 'Deuda no encontrada', fechaOrig, clienteOrig };
}


// ───────────────────────────────────────────────────────────────────
//  HELPERS
// ───────────────────────────────────────────────────────────────────

function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Hoja "' + name + '" no encontrada en la planilla');
  return sheet;
}

function getOrCreateDeudas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('DEUDAS');
  if (!sheet) {
    sheet = ss.insertSheet('DEUDAS');
    const headers = [['Fecha','Cliente','Monto','Moneda','Estado',
                       'Observaciones','Creado Por','Fecha Creación','Cobrado Por','Fecha Cobro']];
    sheet.getRange(1, 1, 1, 10).setValues(headers);
    sheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#f0eaf8');
    sheet.setColumnWidth(1, 100);
    sheet.setColumnWidth(2, 160);
    sheet.setColumnWidth(6, 200);
  }
  return sheet;
}

/** Convierte yyyy-mm-dd → d/m/yyyy. Si ya está en otro formato, lo deja igual. */
function normalizarFecha(fecha) {
  if (!fecha) return '';
  fecha = String(fecha).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    const [y, m, d] = fecha.split('-');
    return parseInt(d) + '/' + parseInt(m) + '/' + y;
  }
  return fecha;
}

function toNum(val) {
  return parseFloat(String(val || '0').replace(/[$,]/g, '')) || 0;
}

function ahora() {
  const now = new Date();
  const tz  = 'America/Argentina/Buenos_Aires';
  return Utilities.formatDate(now, tz, 'dd/MM/yyyy HH:mm');
}

/** Compara fila de VENTAS/COMPRAS con fecha+cliente+cantidad */
function matchOp(row, fecha, cliente, cantidad) {
  return String(row[0]).trim() === fecha &&
         String(row[2]).trim() === cliente &&
         String(row[3]).replace(/[$,]/g, '').trim() === cantidad;
}

/** Compara fila de DEUDAS con fecha+cliente+monto */
function matchDeuda(row, fecha, cliente, monto) {
  return String(row[0]).trim() === fecha &&
         String(row[1]).trim() === cliente &&
         String(row[2]).replace(/[$,]/g, '').trim() === monto;
}
