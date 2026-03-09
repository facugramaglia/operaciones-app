# Operaciones App

Sistema de gestión de operaciones de cambio de divisas (compra/venta de dólares). App web mobile-first integrada con Google Sheets como base de datos.

## Stack

- **Frontend**: HTML5 + CSS3 + Vanilla JS (SPA en un solo archivo `index.html`)
- **Backend**: Google Apps Script (`Code.gs`) desplegado como Web App
- **Persistencia**: Google Sheets (hojas: VENTAS, COMPRAS, DEUDAS)
- **APIs externas**: [dolarapi.com](https://dolarapi.com) para cotización del dólar blue

## Archivos

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Toda la UI: splash, PIN auth, dashboard, cargar op, historial, deudas, ajustes |
| `Code.gs` | Backend GAS: endpoints doGet, lógica de negocio, escritura en Sheets |

## Arquitectura

```
[iPhone/Mobile] → index.html (SPA)
                      ↓ fetch()
              [Google Apps Script URL]
                      ↓
              Code.gs doGet(e)
                      ↓
              Google Sheets (VENTAS / COMPRAS / DEUDAS)
```

## Estructura de Sheets

**VENTAS / COMPRAS** (columnas A–M):
- A-H: datos de operación (fecha, operador, cliente, cantidad, precio, total, estado, obs)
- I: balance, J: balance2
- K: timestamp, L: usuario modificó, M: fecha modificación

**DEUDAS** (columnas A–M):
- A=Fecha, B=Operador, C=Cliente, D=Monto, E=Moneda, F=Estado, G=Observaciones, H=Tipo (COBRAR/PAGAR)
- K-M: tracking igual que VENTAS/COMPRAS

## Endpoints (Code.gs)

Todos los endpoints son GET con parámetro `action`:

| action | Descripción |
|--------|-------------|
| `add_operation` | Agrega venta o compra |
| `update_status` | Cambia estado de una operación |
| `edit_operation` | Edita campos de una operación |
| `delete_operation` | Elimina una operación |
| `add_deuda` | Agrega deuda (COBRAR o PAGAR) |
| `update_deuda_status` | Cambia estado de deuda |
| `edit_deuda` | Edita una deuda |
| `delete_deuda` | Elimina una deuda |

## Desarrollo

### Modificar frontend
Editar `index.html` directamente. El JS está en `<script>` al final del archivo.

### Modificar backend
Editar `Code.gs`. Para aplicar cambios, desplegar una nueva versión en Google Apps Script Editor.

### Desplegar
1. Abrir Google Apps Script Editor con el proyecto vinculado
2. Hacer cambios en `Code.gs`
3. Desplegar → Nueva implementación → Web App
4. Actualizar la URL en `index.html` si cambió

## Seguridad (ya implementada)

- PIN hasheado con SHA-256 (no se guarda en texto plano)
- Rate limiting en intentos de PIN
- Sanitización XSS en todos los campos de entrada
- Validación de URLs para APIs externas
- Content Security Policy en el HTML

## No hay tests ni linter

Este proyecto no tiene framework de testing ni linter configurado. Las validaciones son manuales en el dispositivo móvil y en Google Apps Script Editor.
