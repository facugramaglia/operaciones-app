// Google Apps Script con tracking de modificaciones + DEUDAS
// VENTAS/COMPRAS: Columnas A-H datos, I balance, J balance 2, K timestamp, L usuario modificó, M fecha modificación
// DEUDAS: Columnas A=Fecha, B=Operador, C=Cliente, D=Monto, E=Moneda, F=Estado, G=Observaciones, K-M tracking igual

function doGet(e) {
  try {
    const params = e.parameter;
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (params.action === 'add_operation') {
      const data = {
        tipo: params.tipo,
        fecha: params.fecha,
        operador: params.operador,
        cliente: params.cliente,
        cantidad: parseFloat(params.cantidad),
        precio: parseFloat(params.precio),
        total: parseFloat(params.total),
        observaciones: params.observaciones || ''
      };
      return addOperation(ss, data);
    }

    if (params.action === 'update_status') {
      const data = {
        action: params.action,
        tipo: params.tipo,
        fecha: params.fecha,
        cliente: params.cliente,
        cantidad: parseFloat(params.cantidad),
        nuevoEstado: params.nuevoEstado,
        usuario: params.usuario
      };
      return updateStatus(ss, data);
    }

    if (params.action === 'edit_operation') {
      const data = {
        tipo: params.tipo,
        fecha: params.fecha,
        clienteOriginal: params.clienteOriginal,
        cantidadOriginal: parseFloat(params.cantidadOriginal),
        nuevaCantidad: parseFloat(params.nuevaCantidad),
        nuevoPrecio: parseFloat(params.nuevoPrecio),
        nuevoTotal: parseFloat(params.nuevoTotal),
        nuevasObs: params.nuevasObs || '',
        usuario: params.usuario
      };
      return editOperation(ss, data);
    }

    // ═══════════════════════════════════════════════════════════
    //  DEUDAS
    // ═══════════════════════════════════════════════════════════

    if (params.action === 'add_deuda') {
      const data = {
        fecha: params.fecha,
        operador: params.operador,
        cliente: params.cliente,
        monto: parseFloat(params.monto),
        moneda: params.moneda,
        observaciones: params.observaciones || ''
      };
      return addDeuda(ss, data);
    }

    if (params.action === 'update_deuda_status') {
      const data = {
        fecha: params.fecha,
        cliente: params.cliente,
        monto: parseFloat(params.monto),
        nuevoEstado: params.nuevoEstado,
        usuario: params.usuario
      };
      return updateDeudaStatus(ss, data);
    }

    if (params.action === 'edit_deuda') {
      const data = {
        fecha: params.fecha,             // fecha original para buscar
        clienteOriginal: params.clienteOriginal,
        montoOriginal: parseFloat(params.montoOriginal),
        nuevoMonto: parseFloat(params.nuevoMonto),
        nuevaMoneda: params.nuevaMoneda,
        nuevaFecha: params.nuevaFecha,
        nuevasObs: params.nuevasObs || '',
        usuario: params.usuario
      };
      return editDeuda(ss, data);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Acción no válida'
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (data.action === 'update_status') {
      return updateStatus(ss, data);
    } else if (data.action === 'add_deuda') {
      return addDeuda(ss, data);
    } else if (data.action === 'update_deuda_status') {
      return updateDeudaStatus(ss, data);
    } else if (data.action === 'edit_deuda') {
      return editDeuda(ss, data);
    } else {
      return addOperation(ss, data);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function addOperation(ss, data) {
  const sheetName = data.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Hoja ' + sheetName + ' no encontrada'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let fecha = data.fecha;
  if (fecha.includes('-')) {
    const parts = fecha.split('-');
    fecha = parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  const lastRow = sheet.getRange('B:B').getValues().filter(String).length + 1;
  const newRow = [
    fecha,
    data.operador,
    data.cliente,
    '$' + data.cantidad,
    '$' + data.precio.toFixed(2),
    '$' + data.total.toFixed(0),
    'PENDIENTE',
    data.observaciones || ''
  ];
  sheet.getRange(lastRow, 1, 1, 8).setValues([newRow]);
  sheet.getRange(lastRow, 11).setValue(new Date());
  sheet.getRange(lastRow, 12).setValue(data.operador);
  sheet.getRange(lastRow, 13).setValue(new Date());

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: data.tipo + ' agregada en fila ' + lastRow
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateStatus(ss, data) {
  const sheetName = data.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Hoja no encontrada'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const dataRange = sheet.getDataRange();
  const values = dataRange.getValues();
  const cantidadBuscada = String(data.cantidad).replace(/[\$,\s]/g, '').trim();

  let diaFecha = '', mesFecha = '';
  if (data.fecha && data.fecha.includes('/')) {
    const partes = data.fecha.split('/');
    diaFecha = partes[0];
    mesFecha = partes[1];
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[2] || !row[3]) continue;

    const clienteRow     = String(row[2]).trim().toLowerCase();
    const clienteBuscado = String(data.cliente).trim().toLowerCase();
    const cantidadRow    = String(row[3]).replace(/[\$,\s]/g, '').trim();

    let fechaRow = row[0], diaRow = '', mesRow = '';
    if (fechaRow instanceof Date) {
      diaRow = String(fechaRow.getDate());
      mesRow = String(fechaRow.getMonth() + 1);
    } else if (fechaRow) {
      const fechaStr = String(fechaRow).trim();
      if (fechaStr.includes('/')) {
        const partes = fechaStr.split('/');
        diaRow = partes[0];
        mesRow = partes[1];
      }
    }

    if (clienteRow === clienteBuscado && cantidadRow == cantidadBuscada &&
        diaRow === diaFecha && mesRow === mesFecha) {
      sheet.getRange(i + 1, 7).setValue(data.nuevoEstado);
      sheet.getRange(i + 1, 12).setValue(data.usuario);
      sheet.getRange(i + 1, 13).setValue(new Date());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Estado actualizado en fila ' + (i + 1) + ' a: ' + data.nuevoEstado
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Operación no encontrada. Cliente: ' + data.cliente + ', Cantidad: $' + cantidadBuscada + ', Fecha: ' + data.fecha
  })).setMimeType(ContentService.MimeType.JSON);
}

function editOperation(ss, data) {
  const sheetName = data.tipo === 'VENTA' ? 'VENTAS' : 'COMPRAS';
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false, error: 'Hoja no encontrada'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let fechaBuscar = data.fecha;
  if (fechaBuscar && fechaBuscar.includes('-')) {
    const parts = fechaBuscar.split('-');
    fechaBuscar = parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  const values = sheet.getDataRange().getValues();
  const cantidadBuscada = String(data.cantidadOriginal).replace(/[\$,\s]/g, '').trim();
  let diaFecha = '', mesFecha = '';
  if (fechaBuscar && fechaBuscar.includes('/')) {
    const partes = fechaBuscar.split('/');
    diaFecha = partes[0];
    mesFecha = partes[1];
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[2] || !row[3]) continue;

    const clienteRow     = String(row[2]).trim().toLowerCase();
    const clienteBuscado = String(data.clienteOriginal).trim().toLowerCase();
    const cantidadRow    = String(row[3]).replace(/[\$,\s]/g, '').trim();
    let fechaRow = row[0], diaRow = '', mesRow = '';
    if (fechaRow instanceof Date) {
      diaRow = String(fechaRow.getDate());
      mesRow = String(fechaRow.getMonth() + 1);
    } else if (fechaRow) {
      const partes = String(fechaRow).split('/');
      diaRow = partes[0]; mesRow = partes[1];
    }

    if (clienteRow === clienteBuscado && cantidadRow == cantidadBuscada &&
        diaRow === diaFecha && mesRow === mesFecha) {
      sheet.getRange(i + 1, 4).setValue('$' + data.nuevaCantidad);
      sheet.getRange(i + 1, 5).setValue('$' + data.nuevoPrecio.toFixed(2));
      sheet.getRange(i + 1, 6).setValue('$' + data.nuevoTotal.toFixed(0));
      sheet.getRange(i + 1, 8).setValue(data.nuevasObs);
      sheet.getRange(i + 1, 12).setValue(data.usuario);
      sheet.getRange(i + 1, 13).setValue(new Date());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Operación actualizada en fila ' + (i + 1)
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Operación no encontrada para editar'
  })).setMimeType(ContentService.MimeType.JSON);
}

// ═══════════════════════════════════════════════════════════
//  FUNCIONES PARA DEUDAS
// ═══════════════════════════════════════════════════════════

function addDeuda(ss, data) {
  const sheet = ss.getSheetByName('DEUDAS');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Hoja DEUDAS no encontrada. Creá una hoja llamada "DEUDAS" en tu spreadsheet.'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let fecha = data.fecha;
  if (fecha.includes('-')) {
    const parts = fecha.split('-');
    fecha = parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  const lastRow = sheet.getRange('C:C').getValues().filter(String).length + 1;
  // A=Fecha, B=Operador, C=Cliente, D=Monto, E=Moneda, F=Estado, G=Observaciones
  const newRow = [
    fecha,
    data.operador,
    data.cliente,
    data.monto,
    data.moneda,
    'PENDIENTE',
    data.observaciones || ''
  ];
  sheet.getRange(lastRow, 1, 1, 7).setValues([newRow]);
  sheet.getRange(lastRow, 11).setValue(new Date());
  sheet.getRange(lastRow, 12).setValue(data.operador);
  sheet.getRange(lastRow, 13).setValue(new Date());

  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    message: 'Deuda agregada en fila ' + lastRow
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateDeudaStatus(ss, data) {
  const sheet = ss.getSheetByName('DEUDAS');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Hoja DEUDAS no encontrada'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const values = sheet.getDataRange().getValues();
  const montoBuscado = String(data.monto).replace(/[\$,\s]/g, '').trim();

  let diaFecha = '', mesFecha = '';
  if (data.fecha && data.fecha.includes('/')) {
    const partes = data.fecha.split('/');
    diaFecha = partes[0];
    mesFecha = partes[1];
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[2] || !row[3]) continue;

    const clienteRow     = String(row[2]).trim().toLowerCase();
    const clienteBuscado = String(data.cliente).trim().toLowerCase();
    const montoRow       = String(row[3]).replace(/[\$,\s]/g, '').trim();
    let fechaRow = row[0], diaRow = '', mesRow = '';
    if (fechaRow instanceof Date) {
      diaRow = String(fechaRow.getDate());
      mesRow = String(fechaRow.getMonth() + 1);
    } else if (fechaRow) {
      const partes = String(fechaRow).split('/');
      diaRow = partes[0]; mesRow = partes[1];
    }

    if (clienteRow === clienteBuscado && montoRow == montoBuscado &&
        diaRow === diaFecha && mesRow === mesFecha) {
      sheet.getRange(i + 1, 6).setValue(data.nuevoEstado); // F = Estado
      sheet.getRange(i + 1, 12).setValue(data.usuario);
      sheet.getRange(i + 1, 13).setValue(new Date());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Estado de deuda actualizado a: ' + data.nuevoEstado
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Deuda no encontrada'
  })).setMimeType(ContentService.MimeType.JSON);
}

function editDeuda(ss, data) {
  const sheet = ss.getSheetByName('DEUDAS');
  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Hoja DEUDAS no encontrada'
    })).setMimeType(ContentService.MimeType.JSON);
  }

  let fechaBuscar = data.fecha;
  if (fechaBuscar && fechaBuscar.includes('-')) {
    const parts = fechaBuscar.split('-');
    fechaBuscar = parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  let nuevaFechaFormato = data.nuevaFecha;
  if (nuevaFechaFormato && nuevaFechaFormato.includes('-')) {
    const parts = nuevaFechaFormato.split('-');
    nuevaFechaFormato = parts[2] + '/' + parts[1] + '/' + parts[0];
  }

  const values = sheet.getDataRange().getValues();
  const montoBuscado = String(data.montoOriginal).replace(/[\$,\s]/g, '').trim();
  let diaFecha = '', mesFecha = '';
  if (fechaBuscar && fechaBuscar.includes('/')) {
    const partes = fechaBuscar.split('/');
    diaFecha = partes[0];
    mesFecha = partes[1];
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (!row[2] || !row[3]) continue;

    const clienteRow     = String(row[2]).trim().toLowerCase();
    const clienteBuscado = String(data.clienteOriginal).trim().toLowerCase();
    const montoRow       = String(row[3]).replace(/[\$,\s]/g, '').trim();
    let fechaRow = row[0], diaRow = '', mesRow = '';
    if (fechaRow instanceof Date) {
      diaRow = String(fechaRow.getDate());
      mesRow = String(fechaRow.getMonth() + 1);
    } else if (fechaRow) {
      const partes = String(fechaRow).split('/');
      diaRow = partes[0]; mesRow = partes[1];
    }

    if (clienteRow === clienteBuscado && montoRow == montoBuscado &&
        diaRow === diaFecha && mesRow === mesFecha) {
      sheet.getRange(i + 1, 1).setValue(nuevaFechaFormato); // A: Fecha
      sheet.getRange(i + 1, 4).setValue(data.nuevoMonto);   // D: Monto
      sheet.getRange(i + 1, 5).setValue(data.nuevaMoneda);  // E: Moneda
      sheet.getRange(i + 1, 7).setValue(data.nuevasObs);    // G: Observaciones
      sheet.getRange(i + 1, 12).setValue(data.usuario);
      sheet.getRange(i + 1, 13).setValue(new Date());
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: 'Deuda actualizada en fila ' + (i + 1)
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    error: 'Deuda no encontrada para editar'
  })).setMimeType(ContentService.MimeType.JSON);
}

function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const sheetNames = ['VENTAS', 'COMPRAS', 'DEUDAS'];
  if (!sheetNames.includes(sheet.getName())) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();
  if (row >= 2 && col <= 8) {
    const timestampCell = sheet.getRange(row, 11);
    if (!timestampCell.getValue()) {
      timestampCell.setValue(new Date());
    }
    const user = Session.getActiveUser().getEmail().split('@')[0];
    sheet.getRange(row, 12).setValue(user);
    sheet.getRange(row, 13).setValue(new Date());
  }
}

/*
═══════════════════════════════════════════════════════════════════════════
ESTRUCTURA DE COLUMNAS:
═══════════════════════════════════════════════════════════════════════════
VENTAS / COMPRAS:
  A: Fecha          B: Operador       C: Cliente
  D: Cantidad       E: Precio         F: Total
  G: Estado         H: Observaciones
  I: Balance (fórmula)  J: Balance 2 (fórmula)
  K: Timestamp      L: Usuario modificó    M: Fecha modificación

DEUDAS:
  A: Fecha          B: Operador       C: Cliente
  D: Monto          E: Moneda (USD/ARS)
  F: Estado (PENDIENTE/COBRADA)       G: Observaciones
  K: Timestamp      L: Usuario modificó    M: Fecha modificación
═══════════════════════════════════════════════════════════════════════════
*/
