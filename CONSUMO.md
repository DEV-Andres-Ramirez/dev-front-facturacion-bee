# Cómo consumir el servicio de correo

Guía de integración del backend `dev-back-facturacion-bee` (NestJS) desde el
frontend `dev-front-facturacion-bee` (**Angular 21**, standalone + signals +
zoneless, desplegado en Vercel).

El backend expone un único servicio: **enviar correos** con asunto, cuerpo,
destinatario principal, copias, copias ocultas y adjuntos.

> **Para el agente que integra el front:** este documento es la especificación
> completa. **No modifiques nada dentro de `dev-back-facturacion-bee`**: si algo
> del contrato no encaja, dilo en vez de cambiar el backend.

---

## 1. Datos de conexión

| Concepto | Valor |
| --- | --- |
| URL base (producción) | `https://dev-back-facturacion-bee.vercel.app` |
| URL base (local) | `http://localhost:3000` |
| Autenticación | Header `x-api-key` en **todas** las llamadas a `/api/email/*` |
| API key | `0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d` |
| Formato | `application/json` (recomendado) o `multipart/form-data` |
| CORS | Ya autoriza `https://dev-front-facturacion-bee.vercel.app`, sus *previews* y `http://localhost:4200` |

Escribe la URL base **sin barra final**: el servicio la concatena con
`/api/email/send`, y dejarla como `.../` generaría una ruta con doble barra.

Es la misma clave en producción y en local: sale de la variable `API_KEY` del
backend, que tiene idéntico valor en Vercel y en el `.env` de desarrollo. No es
un secreto criptográfico —viaja en el bundle del navegador—, por eso figura aquí
a propósito; lee la sección 7 antes de tratarla como tal.

---

## 2. Endpoints

| Método | Ruta | Auth | Para qué |
| --- | --- | --- | --- |
| `GET` | `/api/health` | No | Comprobar que el servicio responde |
| `POST` | `/api/email/send` | Sí | **Enviar un correo (usa este)** |
| `POST` | `/api/email/send-multipart` | Sí | Enviar subiendo archivos como `form-data` |
| `GET` | `/docs` | No | Swagger UI para probar a mano |

**Un correo por petición.** No hay endpoint de lote: enviando de uno en uno
sabes exactamente qué factura falló y no se agota el límite de 60 s por
invocación que tiene Vercel. En la pantalla *Entregar* eso encaja de forma
natural con la barra de progreso que ya existe.

---

## 3. Contrato de `POST /api/email/send`

### Petición

```jsonc
{
  // ── Destinatarios ──────────────────────────────────────────────────────
  // Aceptan: "a@x.com" | "a@x.com, b@y.com" | ["a@x.com","b@y.com"]
  // El backend limpia espacios y elimina duplicados (ignorando mayúsculas).
  "to":      ["facturacion_proveedores@banistmo.com"],  // OBLIGATORIO, mínimo 1
  "cc":      ["aprobador@cliente.com"],                  // opcional
  "bcc":     ["archivo@beeconsultoria.com"],             // opcional
  "replyTo": "facturacion@beeconsultoria.com",           // opcional

  // ── Contenido ──────────────────────────────────────────────────────────
  "subject": "Emisión Factura",        // OBLIGATORIO, no vacío, máx. 500
  "html":    "<p>Buen día...</p>",      // html o text: AL MENOS UNO
  "text":    "Buen día...",             // enviar ambos = correo con las dos versiones

  // ── Adjuntos (los tres modos se pueden combinar) ───────────────────────
  "attachmentUrls": [                   // ✅ RECOMENDADO
    {
      "url": "https://xxxx.supabase.co/storage/v1/object/public/facturacion-bee/factura.pdf",
      "filename": "FACTURA BEE 702.pdf",  // opcional; si falta se deduce de la URL
      "contentType": "application/pdf",   // opcional
      "cid": "logo"                       // opcional, para incrustar en el HTML
    }
  ],
  "attachments": [                      // contenido en base64
    {
      "filename": "nota.pdf",            // OBLIGATORIO
      "content": "JVBERi0xLjcK...",      // OBLIGATORIO (admite el prefijo "data:...;base64,")
      "contentType": "application/pdf",  // opcional
      "cid": "logo"                      // opcional
    }
  ]
}
```

**El remitente no se puede elegir.** Sale siempre de la configuración del
backend (`facturacion@beeconsultoria.com`). Cualquier campo que no esté en esta
lista —`from` incluido— se descarta en silencio.

### Respuesta correcta — `200 OK`

```json
{
  "success": true,
  "messageId": "<a1b2c3@beeconsultoria.com>",
  "accepted": ["facturacion_proveedores@banistmo.com", "aprobador@cliente.com"],
  "rejected": [],
  "attachments": 2,
  "durationMs": 1834
}
```

> Revisa siempre `rejected`: un `200` con direcciones ahí significa que el
> servidor aceptó el mensaje pero descartó a esos destinatarios.

### Respuesta con error — mismo formato para todos los códigos

```json
{
  "success": false,
  "statusCode": 400,
  "code": "BAD_REQUEST",
  "message": ["Cada valor de \"to\" debe ser un correo válido."],
  "path": "/api/email/send",
  "timestamp": "2026-07-30T18:34:05.178Z"
}
```

`message` es un **arreglo** cuando falla la validación del cuerpo y una
**cadena** cuando falla un servicio. Trata ambos casos.

| Código | `code` | Qué pasó | Qué hacer en el front |
| --- | --- | --- | --- |
| `400` | `BAD_REQUEST` | Falta un campo, un correo está mal escrito, un adjunto es inválido o su host no está autorizado | Mostrar el mensaje: es accionable para el usuario |
| `401` | `UNAUTHORIZED` | Falta el header `x-api-key` o es incorrecto | Error de configuración, no del usuario |
| `413` | `PAYLOAD_TOO_LARGE` | Adjuntos demasiado grandes o demasiados | Sugerir usar `attachmentUrls` |
| `502` | `EAUTH` | El servidor SMTP rechazó las credenciales | Avisar a soporte, no reintentar |
| `504` | `ECONNECTION` / `ETIMEDOUT` | El servidor SMTP no respondió | Permitir reintentar esa factura |

---

## 4. Adjuntos: cuál de los tres modos usar

> ⚠️ **Vercel corta cualquier petición de más de 4.5 MB.** Es un límite duro de
> la plataforma; no se puede subir por configuración.

| Modo | Campo | Límite | Cuándo usarlo |
| --- | --- | --- | --- |
| **Por URL** ✅ | `attachmentUrls` | 20 MB por archivo | **Siempre que puedas.** El backend descarga el archivo por su cuenta, así que no pasa por el cuerpo de la petición y esquiva el tope de 4.5 MB |
| Base64 | `attachments` | 4 MB por archivo | Un archivo que el usuario acaba de elegir y todavía no está en Storage |
| Multipart | `/send-multipart` | 4 MB por archivo | Formularios tradicionales; no admite `cid` |

**Límites globales:** máximo **10 adjuntos** y **20 MB en total** por correo
(Office 365 rechaza mensajes de más de 25 MB).

### Por qué `attachmentUrls` es el modo natural para este front

La app **nunca tiene los bytes** de las facturas: sube los archivos a Supabase
Storage y guarda su URL pública. Las URLs ya están en la base de datos:

| Documento | Dónde está la URL |
| --- | --- |
| Factura BEE (PDF) | `registro_facturacion_interna.documento_factura_bee` |
| Pedido de compra (PDF) | `registro_facturacion_interna.documento_pedido_compra` |
| Prefactura / Registro interno / Novedades (XLSX) | `documentos_facturacion.direccion_documento_facturacion` |

Pásalas tal cual en `attachmentUrls`. El backend solo acepta hosts `*.supabase.co`
y `*.supabase.in` (lista blanca anti-SSRF), lo que cubre el bucket
`facturacion-bee`.

---

## 5. Probar antes de programar

```bash
# 1. ¿Está vivo?
curl https://dev-back-facturacion-bee.vercel.app/api/health

# 2. Correo mínimo
curl -X POST https://dev-back-facturacion-bee.vercel.app/api/email/send \
  -H 'content-type: application/json' \
  -H 'x-api-key: 0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d' \
  -d '{"to":"destino@cliente.com","subject":"Prueba","text":"Hola"}'

# 3. Correo completo, con copias y un adjunto desde Supabase Storage
curl -X POST https://dev-back-facturacion-bee.vercel.app/api/email/send \
  -H 'content-type: application/json' \
  -H 'x-api-key: 0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d' \
  -d '{
    "to": "facturacion_proveedores@banistmo.com",
    "cc": "aprobador@cliente.com, otro@cliente.com",
    "subject": "Emisión Factura",
    "html": "<p>NUMERO DE FACTURA: BEE-702</p>",
    "attachmentUrls": [
      { "url": "https://xxxx.supabase.co/storage/v1/object/public/facturacion-bee/f.pdf",
        "filename": "FACTURA BEE 702.pdf" }
    ]
  }'
```

---

## 6. Integración en Angular — paso a paso

### Paso 1 · Añadir la configuración de la API al entorno

El proyecto **no usa `process.env` ni `NEXT_PUBLIC_*`**: la configuración se
resuelve en tiempo de compilación con el *file replacement* de `angular.json`.
Hay que tocar tres archivos.

`src/environments/environment.model.ts` — añadir al final de la interfaz:

```ts
export interface AppEnvironment {
  // ...lo que ya existe (production, appName, org, tagline, supabase)

  /**
   * Backend de correo. La `key` viaja en el bundle del navegador y por tanto es
   * pública: protege el uso casual, no es un secreto. Ver la nota de seguridad
   * en CONSUMO.md.
   */
  readonly api: {
    readonly url: string;
    readonly key: string;
  };
}
```

`src/environments/environment.ts` (desarrollo):

```ts
api: {
  url: 'http://localhost:3000',
  key: '0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d',
},
```

`src/environments/environment.production.ts`:

```ts
api: {
  url: 'https://dev-back-facturacion-bee.vercel.app',
  key: '0ba6401d8c62ff41231376d2649f2a71d6bfb154d61a1bb593fd16aabf73908d',
},
```

La clave es la misma en los dos archivos; lo único que cambia es la `url`. Si
algún día se rota la `API_KEY` del backend, hay que actualizar ambos.

### Paso 2 · Habilitar `HttpClient`

Hoy el proyecto **no tiene ninguna infraestructura HTTP** (todo va por
`@supabase/supabase-js`). Hay que añadir el proveedor en
`src/app/app.config.ts`:

```ts
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()), // ← añadir
    provideRouter(/* ... */),
  ],
};
```

### Paso 3 · Crear el servicio

`src/app/core/services/email.service.ts`:

```ts
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';

/** Adjunto que el backend descarga desde Supabase Storage. */
export interface AdjuntoPorUrl {
  readonly url: string;
  readonly filename?: string;
}

export interface CorreoRequest {
  readonly to: string | readonly string[];
  readonly cc?: string | readonly string[];
  readonly bcc?: string | readonly string[];
  readonly replyTo?: string;
  readonly subject: string;
  readonly html?: string;
  readonly text?: string;
  readonly attachmentUrls?: readonly AdjuntoPorUrl[];
}

export interface CorreoEnviado {
  readonly success: true;
  readonly messageId: string;
  readonly accepted: readonly string[];
  readonly rejected: readonly string[];
  readonly attachments: number;
  readonly durationMs: number;
}

/** Envío de correos a través del backend dev-back-facturacion-bee. */
@Injectable({ providedIn: 'root' })
export class EmailService {
  private readonly http = inject(HttpClient);
  private readonly api = environment.api;

  async enviar(correo: CorreoRequest): Promise<CorreoEnviado> {
    return firstValueFrom(
      this.http.post<CorreoEnviado>(`${this.api.url}/api/email/send`, correo, {
        headers: { 'x-api-key': this.api.key },
      }),
    );
  }
}

/**
 * Extrae el mensaje que el backend devuelve en `message`, que llega como
 * arreglo cuando falla la validación y como cadena cuando falla un servicio.
 */
export function mensajeDeError(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const detalle: unknown = error.error?.message;
    if (Array.isArray(detalle)) return detalle.join(' ');
    if (typeof detalle === 'string') return detalle;
    if (error.status === 0) return 'No se pudo contactar con el servicio de correo.';
    return `Error ${error.status} al enviar el correo.`;
  }
  return 'Error inesperado al enviar el correo.';
}
```

### Paso 4 · Sustituir el envío simulado

El punto de integración es **`Entregar.confirmarEnviar()`** en
`src/app/features/entregar/entregar.ts`. Hoy es un `setInterval` que cuenta
180 s por plantilla sin llamar a ningún servicio; hay que reemplazarlo por un
recorrido secuencial que reutiliza las señales que ya existen
(`enviando`, `enviados`, `indice`, `completado`, `total`).

```ts
private readonly email = inject(EmailService);

/** Facturas que fallaron, para mostrarlas al terminar. */
protected readonly errores = signal<{ secuencial: string; motivo: string }[]>([]);

protected async confirmarEnviar(): Promise<void> {
  this.confirmEnviar.set(false);
  this.enviando.set(true);
  this.completado.set(false);
  this.indice.set(0);
  this.enviados.set(0);
  this.errores.set([]);

  // Secuencial y no en paralelo: da progreso real por factura, permite saber
  // cuál falló y no satura el buzón de salida con envíos simultáneos.
  for (const [posicion, plantilla] of this.plantillas().entries()) {
    this.indice.set(posicion);
    try {
      await this.email.enviar({
        to: plantilla.to,
        cc: plantilla.cc,
        subject: plantilla.subject,
        html: this.comoHtml(plantilla.bodyLines),
        text: plantilla.bodyLines.join('\n'),
        attachmentUrls: plantilla.adjuntos,
      });
      this.enviados.update((n) => n + 1);
    } catch (error) {
      this.errores.update((lista) => [
        ...lista,
        { secuencial: plantilla.secuencial, motivo: mensajeDeError(error) },
      ]);
    }
  }

  this.enviando.set(false);
  this.completado.set(true);
}

/** Convierte las líneas del cuerpo en párrafos HTML. */
private comoHtml(lineas: readonly string[]): string {
  return lineas.map((linea) => `<p style="margin:0 0 8px">${escaparHtml(linea)}</p>`).join('');
}
```

Con `escaparHtml` en `src/app/core/utils/`:

```ts
/**
 * Escapa el texto antes de incrustarlo en el HTML del correo. Las líneas salen
 * de los Excel que sube el usuario, así que un `&` o un `<` romperían el cuerpo.
 */
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
```

Recuerda **eliminar** lo que deja de usarse: `tick()`, `limpiarTimer()`, el
campo `timer`, la constante `SEGUNDOS_POR_CORREO`, las señales `segundos`,
`progreso` y `restante`, y el `implements OnDestroy` si ya no hace falta. En la
plantilla, la barra de progreso debe pasar a medirse en facturas
(`enviados() / total()`) en vez de en segundos.

### Paso 5 · Añadir los adjuntos a la plantilla

`PlantillaCorreo` hoy no tiene adjuntos. Amplía la interfaz y rellénala con las
URLs que ya trae `registro_facturacion_interna`:

```ts
interface PlantillaCorreo {
  readonly secuencial: string;
  readonly to: string;
  readonly cc: string[];
  readonly subject: string;
  readonly bodyLines: string[];
  readonly adjuntos: AdjuntoPorUrl[]; // ← nuevo
}
```

Dentro del `computed()` que construye las plantillas, junto al resto de campos:

```ts
// Las URLs vienen de Supabase Storage; el backend las descarga y las adjunta.
const adjuntos: AdjuntoPorUrl[] = [];
const factura = filas.find((f) => f.documento_factura_bee)?.documento_factura_bee;
const pedido = filas.find((f) => f.documento_pedido_compra)?.documento_pedido_compra;
if (factura) adjuntos.push({ url: factura, filename: `FACTURA ${sec}.pdf` });
if (pedido) adjuntos.push({ url: pedido, filename: `PEDIDO DE COMPRA ${sec}.pdf` });

plantillas.push({ secuencial: sec, to: CORREO_DESTINO, cc, subject: 'Emisión Factura', bodyLines: body, adjuntos });
```

> Los archivos deben estar en un bucket **público** de Supabase Storage (o tener
> URL firmada válida). El backend los descarga sin credenciales.

### Checklist

- [ ] `api: { url, key }` en `environment.model.ts` y en **ambos** `environment*.ts`
- [ ] `provideHttpClient(withFetch())` en `app.config.ts`
- [ ] `core/services/email.service.ts` creado
- [ ] `confirmarEnviar()` llama al servicio; se borró el `setInterval`
- [ ] `PlantillaCorreo.adjuntos` poblado con las URLs de Storage
- [ ] La UI muestra los errores por factura al terminar
- [ ] Probado en local contra `http://localhost:3000`

---

## 7. Seguridad: lo que debes saber

**La API key será visible.** El front es una SPA estática: cualquiera puede
abrir el bundle y leer la clave. Sirve para evitar el uso casual del endpoint,
no es un secreto criptográfico. Por eso está escrita tal cual en este documento
y en `environment*.ts`, ambos versionados: ocultarla en el repositorio daría una
falsa sensación de seguridad sin cambiar quién puede leerla.

- **CORS no protege nada.** Solo lo aplican los navegadores; un `curl` con la
  clave funciona desde cualquier sitio. Es una medida contra el uso desde otras
  webs, no un control de acceso.
- **Para rotar la clave:** cambia `API_KEY` en las variables de entorno de
  Vercel del backend, vuelve a desplegarlo y actualiza `environment.production.ts`.
- **Si en el futuro se necesita seguridad real**, el camino es validar en el
  backend el JWT de Supabase que el usuario ya tiene tras iniciar sesión. Eso
  elimina el secreto del bundle. Coordínalo con quien mantiene el backend.

**Nunca** pongas en el front las credenciales SMTP (`MAIL_USER`,
`MAIL_PASSWORD`): viven solo en el backend.

---

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `CORS policy: No 'Access-Control-Allow-Origin'` | El origen no está en la lista blanca. Pide que añadan tu URL a `CORS_ORIGINS` en Vercel. En local usa el puerto **4200** |
| `401` con la clave puesta | El header debe llamarse exactamente `x-api-key`. **La clave por query string no funciona** (a propósito: quedaría en los logs de acceso) |
| `413` | Los adjuntos superan el tope. Cambia `attachments` (base64) por `attachmentUrls` |
| `400 … no está autorizado para adjuntos` | La URL no apunta a `*.supabase.co`. Pide que amplíen `ATTACHMENT_ALLOWED_HOSTS` |
| `400 … no contiene base64 válido` | Estás mandando el `File` o un `ArrayBuffer` en vez de una cadena base64 |
| `504` al primer intento tras un rato inactivo | Arranque en frío de Vercel + saludo SMTP. Reintenta esa factura |
| `502 EAUTH` | Problema de credenciales en el backend, no del front. Avisa a soporte |
| `error.status === 0` en Angular | Casi siempre es CORS o que el backend no está desplegado. Comprueba `GET /api/health` en el navegador |

---

## 9. Referencia rápida

```
POST {URL_BASE}/api/email/send
Headers: content-type: application/json
         x-api-key: {API_KEY}

Body:  to*, cc, bcc, replyTo, subject*, html†, text†, attachmentUrls, attachments
       * obligatorio   † al menos uno de los dos

200 →  { success, messageId, accepted[], rejected[], attachments, durationMs }
4xx/5xx → { success: false, statusCode, code, message, path, timestamp }

Límites: 10 adjuntos · 20 MB en total · 4 MB por archivo subido en el cuerpo
```
