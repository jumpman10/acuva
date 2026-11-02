# Acuva · Guía de diseño

Interfaz solo oscura. Español rioplatense con voseo. Bordes, no sombras. Un solo CTA verde por vista.

## Colores (nombre → valor → uso)
- bg-deep #05080e: fondo del shell del panel admin
- bg-base #0f172a: fondo de página y del portal del socio
- surface-100 #0e1626: tarjetas y paneles
- surface-200 #101726: elementos elevados (drawer, filas tocables, botones de icono)
- surface-sunken #090e17: inputs del panel admin
- surface-portal #0b1222: inputs y tarjetas del portal
- surface-hover #1e293b: hover de botones ghost y filas
- carnet-ground #0b111e: fondo del carnet, caja del QR, círculo de días, fondo del Drawer
- carnet-panel #131c2e: panel interior del carnet
- text-primary #ffffff · text-secondary #cbd5e1 · text-muted #94a3b8 · text-faint #64748b (solo pies y pistas, no llega a 4.5:1)
- border-subtle rgba(148,163,184,0.10) · border-default rgba(148,163,184,0.18)
- accent #34d399 (marca, CTA, foco, Al día) · accent-hover #6ee7b7 · accent-soft rgba(52,211,153,0.12) · accent-border rgba(52,211,153,0.28)
- avatar-bg #132d2c: avatar con iniciales
- ink-on-accent #080c14: texto sobre accent, warn o danger llenos, y módulos del QR
- status-ok = accent · status-ok-soft = accent-soft · status-ok-border = accent-border
- status-warn #fbbf24 · status-warn-soft rgba(251,191,36,0.12) · status-warn-border rgba(251,191,36,0.28)
- status-danger #f87171 · status-danger-soft rgba(248,113,113,0.12) · status-danger-border rgba(248,113,113,0.28)
- overlay rgba(3,6,10,0.65): fondo detrás del Drawer, con backdrop-blur 3px
- qr-paper #ffffff

## Tipografía
Plus Jakarta Sans (ya cargada en index.html), mono del sistema para DNI, teléfonos y códigos.
- display 28/32, 800, tracking -0.02em: títulos de pantalla
- title 24/28, 700: nombre del socio
- heading 18/24, 700: título de tarjeta o drawer
- body 15/22, 500 · body-sm 13/18, 500 (texto de trabajo del panel) · caption 12/16, 600
- label 11/14, 800, uppercase, tracking 0.12em: solo etiquetas cortas
- mono 13/18, 600, tracking 0.04em
- carnet-status 38px 700 · carnet-days 36px 700

## Espaciado, radios y alturas
- Espacios: 4, 8, 12, 16, 18, 22, 28 px
- Radios: sm 8, md 10, lg 12, xl 14, 2xl 20, card 28, panel 40, pill 999
- Alturas de control: 36 (icono), 44 (panel), 52 (portal), 54 (login)
- Gutter mínimo 16px en mobile. Portal: contenido máx. 440px. Carnet: máx. 400px.

## Estados de membresía (regla única, en este orden)
1. estado_pago es pendiente, saldo o vencido, o días < 0 → vencido → "Vencido" (días < 0) o "Impago" → tono danger
2. días <= 2 → por_vencer → "Vence hoy" / "Vence mañana" / "Vence en 2 d" → tono warn
3. resto → activo → "Al día" (en listas: "N días") → tono ok
Pago parcial: no cambia el tono; suma un chip warn "Debe $X" con saldo_pendiente.

## Voz
Voseo (Ingresá, Mostrá, Tocá). Botones con verbo primero y sin mayúsculas sostenidas. Fechas dd/mm/aaaa, cortas "23 nov". Montos con toLocaleString('es-AR'). Errores que dicen qué pasó y qué hacer.

## Iconos
lucide-react, 15–18px, trazo 2 (2.5 en botones primarios). Botones de icono siempre con aria-label.

## Logos
mago-logo.png (wordmark + QR) en headers y carnet; logo.png solo wordmark; isologo.png favicon y pies. Siempre sobre navy.

