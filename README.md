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

1. En **Authentication → Sign In / Providers → Email**, desactivá **Confirm email**: los socios que da de alta un gimnasio usan un email ficticio (`DNI@acuva.app`).
2. Corré `supabase/01_esquema_multilocal.sql` en el SQL Editor. Crea las tablas si el proyecto es nuevo o actualiza las existentes, y se puede correr más de una vez.

Modelo:

| Tabla | Qué guarda |
|---|---|
| `profiles` | cuenta y rol (`local` / `miembro`) |
| `locales` | el gimnasio, su link (`slug`) y su cupo (`max_members` / `linked_members_count`) |
| `miembros` | la persona: DNI, nombre, contacto |
| `local_miembros` | la membresía de una persona en un local: disciplina, cuota, vencimiento, saldo, QR |
| `accesos`, `pagos`, `disciplinas` | siempre de un local |

Rutas: `/` landing · `/login` ingreso único · `/admin` panel del local · `/{slug}` portal de socios del local.
