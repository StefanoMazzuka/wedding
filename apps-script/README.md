# Conectar Google Sheets a la página de invitados

La interfaz está en `invitados.html`, `guests.css` y `guests.js`, dentro de GitHub Pages.
Apps Script solo conecta esa página con Sheets. `Bridge.html` es un transporte invisible,
no un formulario incrustado. Las respuestas viajan mediante mensajes con origen validado y
un identificador aleatorio por sesión; el código de invitación no se incluye en las URL.
Solo se muestra éxito cuando Apps Script confirma el guardado. No se usa `fetch` con `no-cors`.

## Actualizar la implementación existente

1. Abre **Extensiones → Apps Script** desde tu Google Sheet.
2. Sustituye `Code.gs` por esta versión, conservando tu `SPREADSHEET_ID` real.
3. Crea un archivo **HTML** llamado `Bridge` y copia `Bridge.html`.
   El antiguo archivo `Guests.html` ya no se utiliza; puedes eliminarlo en Google.
4. **Implementar → Gestionar implementaciones → Editar (lápiz) → Nueva versión → Implementar**.
   Conserva **Ejecutar como: Yo** y acceso **Cualquier persona**. No borres la implementación:
   se conserva la URL `/exec`, ya configurada como `guestsApiUrl` en `config.js`.
5. Publica los archivos de la web en GitHub Pages.
6. Desde `invitados.html`, prueba un código de prueba, guarda, comprueba las columnas C–E
   en Sheets y vuelve a abrir la invitación. Prueba también un código inexistente.

La URL de Apps Script por sí sola ahora muestra un mensaje para abrir la web de la boda.
La pestaña se llama `guests`. Columnas A–F: `code`, `id`, `name`, `type`, `attendance`, `position`.
Valores: `adulto` / `niño` y `pendiente` / `sí` / `no`.

Para probar en local: `python3 -m http.server 8000` y abre
`http://localhost:8000/invitados.html`. No abras directamente el archivo con `file://`.
Los orígenes permitidos están en `doGet`: el dominio de la boda, su variante www,
GitHub Pages y localhost:8000. Actualiza esa lista si cambias de dominio o puerto.

## Rama de asistencia

La página dibuja una rama SVG propia en `branch.js`. Al abrirla y después de guardar
una respuesta, pide las posiciones con `attendance = sí`. `no` y `pendiente` no muestran pétalo.
Cada persona tiene un pétalo en una posición fija; no se reorganizan al cambiar respuestas.
La consulta pública `getPetals` devuelve `{ total, petals: [{ position, name }] }`.
`total` es el número de filas de invitados, incluidos niños y +1; `petals` solo incluye
personas con asistencia confirmada. Sus nombres son visibles al pasar el ratón, enfocar
con el teclado o tocar el pétalo; no se devuelven IDs ni códigos.
Las posiciones deben ser enteros únicos entre 1 y el total de invitados (sin filas vacías).
La longitud de la rama depende del total de invitados, no del número de confirmaciones.
En móvil (hasta 600 px) la rama crece en vertical y cabe en el ancho de la pantalla;
en ordenador conserva el formato horizontal. Se adapta también al girar el dispositivo.

Para activar esta función, copia las nuevas versiones de **Code.gs y Bridge.html** y
publica una **Nueva versión de la misma implementación**. Conserva tu SPREADSHEET_ID.
Si falla la consulta de pétalos, se indica que no se han podido actualizar y se ofrece
reintentar; el formulario sigue disponible. Los cambios directos en Sheets se ven al
recargar la página o pulsar el botón de reintento tras un error.

Cada persona necesita un ID y una posición únicos. Los miembros de una invitación
comparten código. La web no puede cambiar códigos, ID ni posiciones, ni añadir personas.
Los nombres se pueden corregir; quienes confirmen asistencia deben tener nombre.

El código es la credencial: quien lo conoce puede editar esa invitación. Los códigos
LOTO-XXX son cortos y esta versión no limita intentos de adivinación. Antes de usar datos
reales en una implementación pública, usa sufijos aleatorios más largos (por ejemplo,
12 caracteres). El script ya admite entre 3 y 32 caracteres. No publiques la hoja ni sus códigos.
No hay detección de ediciones simultáneas de la misma invitación: prevalece el último guardado.

Documentación: https://developers.google.com/apps-script/guides/web
y https://developers.google.com/apps-script/guides/html/communication
