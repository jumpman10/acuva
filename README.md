<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3497c04e-f33b-48b2-a62f-aade735c306d

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Base de datos (Supabase)

1. Corré `supabase/01_esquema_multilocal.sql` y después `supabase/02_auth_socios.sql` en el SQL Editor (se pueden correr más de una vez).
2. En **Authentication → Sign In / Providers → Email**: **Confirm email** activado, **Secure email change** desactivado (si no, vincular el email pide confirmar desde el `DNI@acuva.app` ficticio) y largo mínimo de contraseña 8.
3. Desplegá la Edge Function de ingreso con DNI (no lleva JWT de usuario; la protegen los límites por DNI e IP):
   `supabase functions deploy member-login --no-verify-jwt`
4. En **Authentication → URL Configuration**, agregá la URL de la app como Redirect URL (el link de confirmación del email vuelve ahí).

Tipos de socio: *solo carnet* (sin acceso a la app), *básico* (entra con DNI + contraseña que crea en su primer ingreso, si el gimnasio le habilitó el acceso) y *verificado* (vinculó su email: entra con email y el DNI deja de servir).

Modelo:

| Tabla | Qué guarda |
|---|---|
| `profiles` | cuenta y rol (`local` / `miembro`) |
| `locales` | el gimnasio, su link (`slug`) y su cupo (`max_members` / `linked_members_count`) |
| `miembros` | la persona: DNI, nombre, contacto |
| `local_miembros` | la membresía de una persona en un local: disciplina, cuota, vencimiento, saldo, QR |
| `accesos`, `pagos`, `disciplinas` | siempre de un local |

Rutas: `/` landing · `/login` ingreso único · `/admin` panel del local · `/{slug}` portal de socios del local.
