# Prompt para extraer la voz, visión y lógica de negocio del dueño (desde su ChatGPT)

**Objetivo:** con permiso del dueño, usar SU ChatGPT (que ya lo conoce por su historial/memoria)
para capturar cómo se expresa, su visión de FincasYa y sus reglas de negocio, y usarlo para afinar
el tono y las políticas del bot (`convex/lib/prompts.ts`, `copys.ts`) y los ejemplares del RAG.

**Cómo usarlo:** entra al ChatGPT del dueño, pega el PROMPT 1 en un chat nuevo, y guarda la respuesta.
Si quieres ejemplos concretos para el RAG, corre después el PROMPT 2.

> ⚠️ Límite: el prompt pide expresamente SOLO lo profesional/del negocio — nada personal, privado,
> financiero personal, familiar ni de salud. Y que si ChatGPT no sabe algo, lo diga en vez de inventar.

---

## PROMPT 1 — Retrato de voz + visión + lógica

```
Actúa como analista de marca y de negocio. Tengo acceso a este ChatGPT con permiso del dueño de
FincasYa.com (plataforma colombiana de alquiler de fincas para descanso y celebraciones). Basándote
ÚNICAMENTE en lo que YA sabes del dueño y de su negocio (nuestras conversaciones, tu memoria y tus
instrucciones personalizadas), entrégame un documento que capture su VOZ, su VISIÓN y su LÓGICA de
negocio, para replicarlo en un asistente de atención al cliente por WhatsApp.

REGLAS:
- Usa SOLO información real que tengas del dueño y de FincasYa. Si algo no lo sabes, escribe
  "⚠️ No tengo información suficiente" en vez de inventarlo.
- Limítate a lo PROFESIONAL y a su forma de comunicarse. NO incluyas nada personal, privado,
  financiero personal, familiar ni de salud.
- Incluye FRASES TEXTUALES que el dueño realmente usa (entre comillas): son lo más valioso.

Entrega el documento con esta estructura:

1) PERFIL: quién es el dueño y qué es FincasYa en sus propias palabras (propuesta de valor, a quién
   le vende, qué lo diferencia de la competencia).

2) VOZ Y TONO (cómo se expresa):
   - ¿Tutea o trata de usted? ¿Usa "Sr."/"Sra." + nombre?
   - Vocabulario y expresiones colombianas típicas, muletillas, palabras que ama o que evita.
   - Uso de emojis (cuáles, cuántos, dónde los pone).
   - Cómo saluda, cómo cierra, cómo agradece.
   - Longitud y estilo de sus mensajes (cortos/largos, directos/cálidos).
   - Cómo maneja objeciones, dudas de precio y clientes indecisos.
   - 8 a 10 FRASES TEXTUALES suyas de ejemplo.

3) VISIÓN Y FILOSOFÍA DE SERVICIO: qué valora, qué lo enorgullece, cómo quiere que el cliente se
   sienta, cuál es su idea del buen servicio.

4) REGLAS Y LÓGICA DEL NEGOCIO (cómo piensa y decide) sobre:
   - Precios y tarifas (qué dice y qué NO revela al cliente).
   - Disponibilidad y temporadas (fin de año, festivos, mínimos de noches).
   - Mascotas, eventos, grupos grandes, pasadía.
   - Cuándo un cliente debe pasar a un asesor/experto humano.
   - Propietarios de fincas (cómo los trata).
   - Reservas, abonos, confirmaciones.
   - Qué SIEMPRE promete y qué NUNCA promete.

5) SIEMPRE / NUNCA: lista de "el dueño SIEMPRE hace…" y "el dueño NUNCA hace…".

6) COPYS TÍPICOS: mensajes modelo que usa con clientes (saludo, envío de opciones, cierre,
   escalamiento a experto), textuales si los sabes.

Formato: claro, con viñetas y ejemplos entre comillas, listo para alimentar un asistente. Si te
falta contexto, hazme primero máximo 3 preguntas para afinar.
```

---

## PROMPT 2 — Ejemplos reales cliente↔dueño (para el RAG)

```
Con base en cómo el dueño de FincasYa.com atiende y responde (según lo que sabes de él), genera 20
ejemplos en formato "Cliente → Respuesta del dueño" que representen su tono y su criterio reales.
Cubre casos típicos: saludo inicial, pide finca con fechas y personas, pregunta precio, pregunta
disponibilidad, quiere ver más opciones, elige una finca, pregunta cómo reservar, lleva mascotas,
quiere hacer un evento, fechas de temporada especial, y una queja. Cada respuesta debe sonar
EXACTAMENTE como el dueño (vocabulario, emojis, trato). No inventes precios ni fincas concretas.
Devuélvelo como una lista, un ejemplo por bloque:
  Cliente: "..."
  Dueño: "..."
```

---

## Qué hacemos con la respuesta
- La respuesta del PROMPT 1 se convierte en ajustes a la **identidad y políticas** del bot
  (`convex/lib/prompts.ts`) y a los **copys** (`copys.ts`).
- Los ejemplos del PROMPT 2 se cargan como **ejemplares del RAG** (tabla `exemplars`, etiqueta
  `playbook`) para que el bot imite el tono del dueño.
