# Nuestra boda · 10 de abril de 2027

Web en español, adaptable a móviles, sin dependencias ni compilación. Incluye cuenta atrás, galería, detalles del evento, preguntas frecuentes y descarga de calendario.

## Personalizar

Edita `config.js` para añadir nombres, ceremonia, celebración, mapas, vestimenta, transporte y enlace a un formulario RSVP. Los campos vacíos conservan un mensaje de «próximamente». Sube las fotos a `assets/images/` y añade sus rutas en `cover` y `photos`. Cada foto admite texto alternativo (`alt`) y un pie (`caption`).

La cuenta atrás apunta por defecto a **las 00:00 del 10 de abril de 2027 en Madrid (UTC+02:00)**: es el inicio del día, no la hora de la ceremonia. Si se celebra en otro huso horario o quieres contar hasta la ceremonia, cambia `date` y `countdownNote`. El calendario reserva el día completo. Si cambias la fecha de la boda, actualiza también `index.html`, `boda.ics` y el título de `script.js`.

Los colores y el diseño están en `styles.css`; los textos principales, en `index.html`.

## Ver en local

Desde esta carpeta:

```sh
python3 -m http.server 8000
```

Abre http://localhost:8000.

## Subir a GitHub Pages

Repositorio previsto: `git@github.com:StefanoMazzuka/wedding.git` (sin la barra invertida antes de `@`).

1. Sube estos archivos al repositorio, en la rama `main`, conservando `.github/workflows/pages.yml`.
2. En GitHub, abre **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. En **Actions**, ejecuta «Publicar web de la boda» o sube un cambio a `main`.
4. Una vez completado el despliegue, la dirección prevista es https://stefanomazzuka.github.io/wedding/.

Referencia oficial: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Consejos para completar la web

- Publica primero fecha, nombres y localidad; añade ubicaciones y horarios cuando estén confirmados.
- Añade un formulario de confirmación y su fecha límite. Puedes enlazar Google Forms mediante `rsvpUrl`; esta web por sí sola no guarda respuestas.
- Pregunta en el formulario por acompañantes y necesidades alimentarias.
- Incluye transporte, aparcamiento, hoteles cercanos y un contacto para dudas.
- Elige entre 3 y 6 fotos y comprímelas para que la web cargue rápido en móvil.
- El contenido publicado en Pages será accesible por enlace: mantén las respuestas de invitados fuera del repositorio.
