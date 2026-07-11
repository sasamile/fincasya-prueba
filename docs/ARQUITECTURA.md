# FincasYa v2 — Agente conversacional de WhatsApp

**Objetivo:** un agente que atiende clientes por WhatsApp con lenguaje natural
(no "a pasos"), que se apoya en el historial real de ventas del equipo y que
mejora solo — sin el riesgo de aprender de sus propios errores.

---

## Arquitectura de capas

```
                 WhatsApp (cliente)
                        │
                     YCloud  ← mismo canal y número de siempre
                        │ webhook
                        ▼
┌───────────────────────────────────────────────────────────┐
│  CAPA 4 · ORQUESTADOR                    convex/agent.ts  │
│  1. recibe mensaje → contexto de la conversación          │
│  2. RAG: busca ejemplos curados parecidos (capa 2)        │
│  3. arma prompt: identidad + políticas (capa 3)           │
│  4. LLM con tools → consulta datos reales (capa 1)        │
│  5. responde por YCloud y guarda el mensaje               │
└──────┬──────────────────┬─────────────────────┬───────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌──────────────┐  ┌────────────────┐  ┌───────────────────┐
│ CAPA 1       │  │ CAPA 2         │  │ CAPA 3            │
│ FUENTE DE    │  │ BASE VECTORIAL │  │ SKILLS / REGLAS   │
│ VERDAD       │  │ (curada)       │  │                   │
│              │  │                │  │ · tono e          │
│ fincas       │  │ exemplars:     │  │   identidad       │
│ precios      │  │ pregunta real  │  │   ("Hernán")      │
│ disponibili- │  │ → respuesta    │  │ · políticas: no   │
│ dad          │  │   que funcionó │  │   descuentos sin  │
│ catálogo     │  │                │  │   aprobación, no  │
│ Meta         │  │ índice de      │  │   inventar datos, │
│ reservas     │  │ embeddings     │  │   escalar a       │
│              │  │ (1536 dims)    │  │   humano          │
│ NUNCA se     │  │                │  │ · qué tools hay   │
│ "aprende":   │  │ solo entra lo  │  │                   │
│ se consulta  │  │ que terminó    │  │ convex/lib/       │
│ en tiempo    │  │ BIEN           │  │ prompts.ts        │
│ real (tools) │  │                │  │                   │
└──────────────┘  └────────────────┘  └───────────────────┘
                          ▲
                          │ cron nocturno (02:30 Colombia)
┌───────────────────────────────────────────────────────────┐
│  PIPELINE DE CURACIÓN                 convex/curation.ts  │
│  etiqueta cada conversación cerrada:                      │
│   · venta        → hubo reserva (señal automática)        │
│   · positiva     → cierre agradecido, sin quejas          │
│   · problemática → quejas/errores → NUNCA entra al RAG    │
│   · neutra       → se ignora                              │
│  extrae pares cliente→respuesta de las buenas,            │
│  prioriza respuestas escritas por Expertoes humanos,       │
│  descarta bloques repetidos, calcula embeddings.          │
└───────────────────────────────────────────────────────────┘
```

## Stack

| Pieza | Elección | Por qué |
|---|---|---|
| Base de datos + backend | **Convex** (proyecto `prueba`, deployment `modest-husky-871`) | Fuente de verdad y base vectorial en un solo lugar; índice vectorial nativo; crons y webhooks incluidos |
| Canal | **YCloud** (mismo número WABA) | Cero migración: al salir a producción solo se cambia la URL del webhook |
| Catálogo | **Meta** (el mismo catálogo actual) | Vive en Meta; el proyecto ya tiene los 137 mapeos finca ↔ product_retailer_id |
| LLM | OpenAI `gpt-4.1` (conversación) + `text-embedding-3-small` (RAG) | Vía fetch directo, sin SDK pesado |
| Runtime | Bun + TypeScript | Igual que el resto del stack FincasYa |

## Los datos históricos ya están adentro

Importados del sistema anterior el 10-jul-2026: 1.433 conversaciones,
19.520 mensajes, 1.317 contactos, 63 reservas, 148 fincas, 137 mapeos de
catálogo Meta y 35 plantillas del playbook del equipo.

Primera curación ejecutada sobre ese histórico:

| Etiqueta | Conversaciones | Destino |
|---|---|---|
| venta | 34 | ejemplares para el RAG |
| positiva | 201 | ejemplares para el RAG |
| problemática | 11 | excluidas como ejemplo |
| neutra | 1.187 | ignoradas |

Resultado: **279 ejemplares curados e indexados** (244 del histórico +
35 del playbook), todos con embedding calculado.

## El "aprender solo" (sin curación manual constante)

- Cada noche (cron 02:30) el pipeline revisa las conversaciones nuevas:
  las que terminaron en reserva o cierre positivo entran solas al índice;
  las problemáticas quedan marcadas y jamás se usan como ejemplo.
- Las respuestas escritas a mano por Expertoes (`sentByUserId`) tienen
  prioridad sobre las del bot: el agente aprende del equipo, no de sí mismo.
- Todo queda auditado en `conversationLabels` (por qué se etiquetó así,
  cuántos ejemplares salieron de cada conversación).

## Fases

1. **Hecha — Fundación.** Migración del histórico, schema, curación inicial,
   índice vectorial, agente con tools (buscar fincas, disponibilidad,
   escalar a humano), webhook YCloud, cron nocturno.
2. **Ajuste fino.** Probar con el equipo en el número de pruebas: afinar tono,
   políticas y filtros de curación; agregar tools de cotización exacta
   (temporadas/sub-reglas de capacidad) y envío de fichas del catálogo Meta.
3. **Corte de canal.** Apuntar el webhook de YCloud de producción a
   `https://modest-husky-871.convex.site/ycloud/webhook` (o al deployment de
   producción). Es un switch: un solo bot responde a la vez.
4. **Operación.** Panel/inbox para Expertoes (escalados, prioridades) y
   métricas: tasa de escalado, conversaciones→reserva, ejemplares nuevos/semana.
