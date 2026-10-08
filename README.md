# Nuestra boda · 10 de abril de 2027

Web en español, adaptable a móviles, sin dependencias ni compilación. Incluye cuenta atrás, galería, detalles del evento, preguntas frecuentes y descarga de calendario.

## Personalizar

Edita `config.js` para añadir nombres, ceremonia, celebración, mapas, vestimenta, transporte y URL de Apps Script (`guestsApiUrl`). Los campos vacíos conservan un mensaje de «próximamente». Sube las fotos a `assets/images/` y añade sus rutas en `cover` y `photos`. Cada foto admite texto alternativo (`alt`) y un pie (`caption`).

La cuenta atrás apunta por defecto a **las 00:00 del 10 de abril de 2027 en Madrid (UTC+02:00)**: es el inicio del día, no la hora de la ceremonia. Si se celebra en otro huso horario o quieres contar hasta la ceremonia, cambia `date` y `countdownNote`. El calendario reserva el día completo. Si cambias la fecha de la boda, actualiza también `index.html`, `boda.ics` y el título de `script.js`.

Los colores y el diseño están en `styles.css`; los textos principales, en `index.html`.

## Ver en local

Desde esta carpeta:

```sh
python3 -m http.server 8000
```

Abre http://localhost:8000. Para probar las invitaciones, abre
http://localhost:8000/invitados.html.

**No abras `invitados.html` directamente con `file://`**, tampoco desde una ruta
como `file://wsl.localhost/Ubuntu-24.04/.../invitados.html`: ese modo no tiene
un origen web autorizado para comunicarse con Apps Script y mostrará un error de conexión.
En WSL, ejecuta el comando anterior desde la carpeta del proyecto y abre la dirección
`http://localhost:8000/invitados.html` en el navegador de Windows.

El servidor Python es **solo para pruebas locales**. Puedes detenerlo con `Ctrl+C`.
En producción, GitHub Pages aloja la web, Apps Script consulta y actualiza la hoja,
y Google Sheets guarda los datos. No necesitas dejar tu ordenador encendido.

## Invitaciones y Google Sheets

La interfaz está en `invitados.html`, con el estilo de la web. La rama muestra un pétalo
por cada persona con `attendance = sí`, según su `position`, y se actualiza tras guardar. La URL de la aplicación
de Apps Script se configura en `guestsApiUrl`, dentro de `config.js`.

Sigue las [instrucciones de Apps Script](apps-script/README.md) para configurar la
pestaña `guests`, copiar `Code.gs` y `Bridge.html`, y actualizar la implementación.
Los cambios en Apps Script se publican por separado de los cambios en GitHub Pages.

Si aparece **«No se pudo conectar»**:

1. Comprueba que la página está abierta por HTTP o HTTPS, no con `file://`.
2. En local, usa el puerto `8000`. Otro puerto requiere actualizar los orígenes
   permitidos en `doGet` y publicar una nueva versión de Apps Script.
3. Comprueba que has publicado los archivos actuales de Apps Script mediante
   **Gestionar implementaciones → Editar → Nueva versión → Implementar**,
   con **Ejecutar como: Yo** y acceso **Cualquier persona**.

Una vez publicados los archivos, la página de invitados estará en
https://marialeystefano.com/invitados.html. Ese dominio ya está permitido en el script.

## Subir a GitHub Pages

Repositorio previsto: `git@github.com:StefanoMazzuka/wedding.git` (sin la barra invertida antes de `@`).

1. Sube estos archivos al repositorio, en la rama `main`.
2. En GitHub, abre **Settings → Pages → Build and deployment → Source → Deploy from a branch**.
3. Selecciona la rama `main`, la carpeta `/ (root)` y guarda.
4. Los siguientes cambios que subas a `main` se publicarán automáticamente.

No se necesita un workflow propio ni un paso de compilación. GitHub muestra su proceso automático de publicación en Actions.

Referencia oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Consejos para completar la web

- Publica primero fecha, nombres y localidad; añade ubicaciones y horarios cuando estén confirmados.
- La página `invitados.html` permite consultar y guardar la respuesta por código en Google Sheets. Configuración y actualización de Apps Script: [instrucciones](apps-script/README.md).
- Pregunta en el formulario por acompañantes y necesidades alimentarias.
- Incluye transporte, aparcamiento, hoteles cercanos y un contacto para dudas.
- Elige entre 3 y 6 fotos y comprímelas para que la web cargue rápido en móvil.
- El contenido publicado en Pages será accesible por enlace: mantén las respuestas de invitados fuera del repositorio.
