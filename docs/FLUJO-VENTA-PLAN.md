# Plan de implementación — Flujo de venta: link → contrato → pago → CR → oferta al propietario

Fecha: 2026-07-16. Base: transcripción de reunión + auditoría del código actual.

## 0. Punto de partida

El flujo descrito **ya existe casi completo** en `saleLinks` (`packages/backend/convex/saleLinks.ts`, 1769 líneas) y el portal `/venta/[token]`. No se construye de cero. Lo que falta es reordenar dos pasos y cerrar cuatro huecos.

### Lo que ya funciona

| Pieza | Dónde |
|---|---|
| Link pregenerado con finca, fechas, valores y cuentas bancarias | `saleLinks.create` (`saleLinks.ts:300`), UI en `/admin/contract-link` |
| Portal del cliente por token, sin login | `apps/web/src/app/venta/[token]/page.tsx` |
| Captura de datos del cliente | `saleLinks.submitClientData` (`saleLinks.ts:721`), `step-datos-contrato.tsx` |
| Subida de soporte + validación por el asesor | `validatePaymentAdmin` (`saleLinks.ts:557`), `/validar-pago/[token]` |
| Extracción del monto del soporte con IA | `lib/receiptAi.ts`, `paymentReceipts.ts:52` |
| Generación del contrato en PDF desde plantilla Word real | `/api/sale-links/[token]/generate-contract`, `lib/server/contract-docx.ts` |
| Generación de la CR en PDF | `/api/sale-links/[token]/generate-cr`, `lib/server/reservation-confirmation-html.ts` |
| Documentos descargables por el admin | `saleLinks.getDocumentForAdmin` (`saleLinks.ts:1099`) |
| Oferta al propietario: aceptar / rechazar / comentar | `bookings.acceptOwnerOffer` (`bookings.ts:2168`), portal `/anfitrion/[reference]` |
| Correo transaccional | `lib/email.ts` (Brevo) + `lib/emailTemplates.ts` |
| Semáforo del calendario con alerta naranja de soporte por revisar | `reservation-calendar-semaphore.ts:109` |

### Los cuatro huecos reales

1. **El orden está invertido.** Hoy: datos → **pago** → contrato. Pedido: datos → **previsualización del contrato en solo lectura** → pago → contrato numerado. `/api/sale-links/[token]/generate-contract` hoy **exige `paymentValidated`** y aborta si no lo hay.
2. **Bold es un link pegado a mano.** Existen `paymentPortalConfig.boldLink` y `boldSurcharge` (`schema.ts:1164`), pero **no hay** cliente API, ni firma de integridad, ni webhook. `payments.boldData` (`schema.ts:1397`) es un campo vacío que nadie escribe. El recargo del 5% hoy es solo un texto informativo.
3. **No hay alertas internas.** No existe tabla de alertas ni bandeja de pendientes. `notification-bell.tsx` es un **stub deshabilitado**. La única señal de "pre-reserva pendiente de pago" hoy sería el semáforo del calendario, que no cubre este estado.
4. **La CR no se envía por correo y la oferta al propietario no se envía sola.** `markOwnerOfferSent` (`saleLinks.ts:1246`) solo marca una casilla; el operador copia el link a mano. No hay ningún `sendEmail` que apunte al propietario.

---

## Fase 1 — Reordenar: previsualización del contrato antes de pagar

**Objetivo:** el cliente lee el contrato completo, en solo lectura y sin numeración, y solo después decide pagar.

1. `apps/web/src/app/api/sale-links/[token]/generate-contract/route.ts` — separar en dos modos:
   - `preview`: no exige `paymentValidated`, solo `clientData.nombre`. Renderiza el PDF con `contractNumber` vacío o marca de agua "BORRADOR — SIN VALOR CONTRACTUAL". **No** sube a S3, **no** llama `attachContract`. Devuelve el PDF en memoria.
   - `final`: comportamiento actual (exige `paymentValidated`, numera, sube a S3, `attachContract`).
2. `lib/server/contract-values.ts` (`buildContractWordValues`) — aceptar `draft: boolean` para omitir numeración.
3. Nuevo paso en el portal: `features/ventas/components/step-contrato-preview.tsx`, visor PDF de solo lectura + "Continuar con el proceso".
4. `saleLinks.clientStep` / `clientDraftPhase` (`schema.ts`) — insertar la fase `preview` entre `datos` y `pago`. Revisar todos los saltos de step en `venta-page-content.tsx`.

**Riesgo:** el orden de steps está cableado en varios sitios. Auditar `clientStep` de punta a punta antes de tocar.

## Fase 2 — Estado "pre-reserva" y alertas internas

**Objetivo:** cuando el cliente genera contrato y aún no paga, el equipo lo ve y hace seguimiento.

1. Nueva tabla `alerts` en `schema.ts`: `{ type, severity, saleLinkId?, bookingId?, propertyId?, title, body, createdAt, resolvedAt?, resolvedBy?, assignedTo? }`, índices `by_unresolved`, `by_sale_link`, `by_type`.
2. Tipos iniciales: `pre_reserva_pendiente_pago`, `soporte_por_validar`, `crear_oferta_propietario`, `reservar_al_propietario`, `segundo_pago_pendiente`.
3. Emitir `pre_reserva_pendiente_pago` al terminar la previsualización (fin de Fase 1).
4. Activar `notification-bell.tsx` (hoy stub) contra `alerts.listUnresolved`, con badge de conteo en `/admin` layout.
5. Bandeja `/admin/alertas` con filtros y resolución manual.

**Decisión pendiente:** ¿la alerta se asigna al asesor que creó el link (`saleLinks.createdBy`) o va a una bandeja común?

## Fase 3 — Bold real (link automático + validación automática)

**Objetivo:** que Bold genere el link con el valor del contrato, aplique el recargo y se autovalide sin soporte.

1. `packages/backend/convex/lib/bold.ts` — cliente API: crear link de pago, firma de integridad, env `BOLD_API_KEY` / `BOLD_SECRET_KEY`.
2. Ruta webhook en `packages/backend/convex/http.ts` (hoy solo tiene YCloud y Meta): verificar firma, buscar el `saleLink` por referencia, marcar `paymentValidated = true` sin intervención humana, escribir `payments.boldData`.
3. Recargo: hoy `boldSurcharge` es texto informativo. Debe entrar en el valor real del link y quedar reflejado en la CR.
4. En el portal: si el medio es Bold, ocultar la subida de soporte (Bold ya valida). Si es transferencia, mostrar las instrucciones y el aviso de enviar soporte por chat.

**Verificar con Bold antes de estimar:** en la reunión se dijo que Bold "se ancla a la página y genera el link automáticamente". Eso aplica al botón de pago del sitio web. Para un link por reserva con monto variable hace falta la API de links de pago — confirmar que el plan contratado la incluye.

## Fase 4 — CR con valor real, correo al cliente y oferta al propietario

1. **CR con el monto reservado.** El contrato dice 50% siempre, pero la CR debe llevar lo efectivamente pagado y el saldo. Revisar `computeConfirmationFinancials` (`lib/server/confirmation-financials.ts:58`), que hoy tiene constantes fijas (`CONFIRMATION_STANDARD_CLEANING_COP = 100_000`).
2. **Correo al cliente** con la CR adjunta al validarse el pago. `lib/email.ts` ya soporta adjuntos por URL; hoy `notifications.ts:183` solo avisa "pago validado" sin documentos.
3. **Alerta `crear_oferta_propietario`** al validar el pago (depende de Fase 2).
4. **Envío automático de la oferta al propietario** por correo y/o WhatsApp. Los datos existen (`propertyOwnerInfo.propietarioCorreo` / `propietarioTelefono`, `schema.ts:736-740`). Convertir `markOwnerOfferSent` de marca manual a envío real.
5. **Alerta `reservar_al_propietario`** cuando el propietario acepta (`onOwnerOfferAcceptedInternal`, `saleLinks.ts:1259`).

## Fase 5 — Segundo pago y política de soportes

Depende de la decisión pendiente (ver abajo). El toggle ya existe: `bookings.clientPaymentProofUploadEnabled` (`schema.ts:950`), consumido por `checkin-payment-section.tsx`.

## Fase 6 — Chat propio 24/7 en FincaChat

Proyecto aparte, no es una fase de este flujo. Hoy toda la mensajería sale por YCloud/WhatsApp (`convex/http.ts:246`, `checkinMessaging.ts`). Un chat web propio con presencia y adjuntos es un esfuerzo comparable al de las fases 1–4 juntas. Recomiendo tratarlo como épica independiente.

---

## Orden recomendado

**1 → 2 → 4 → 3 → 5.** Las fases 1 y 2 no dependen de terceros y desbloquean el seguimiento comercial de inmediato. La 4 reutiliza infraestructura que ya existe. La 3 depende de confirmar el plan de Bold. La 5 depende de una decisión de negocio.

## Decisiones pendientes

1. **Soportes en el check-in.** En la reunión se dijo primero que el cliente **no** debe cargar soporte (solo enviarlo por chat), y después que en el **primer pago sí** puede subirlo. ¿Se permite en el primer pago y se prohíbe en el segundo, o todo va por chat?
2. **Asignación de alertas:** ¿bandeja común o por asesor?
3. **Bold:** ¿el plan contratado incluye API de links de pago con monto variable?

## Deuda técnica relevante que toca este flujo

- **Numeración de contratos triplicada** y sin fuente única: manual (`CR 2041`, validado en `saleLinks.ts:115`), `VL-${token8}` (`lib/saleLinkReference.ts:9`), y `DIR-${FINCA}-${base36}` (`direct-booking-contract/route.ts:21`). La Fase 1 obliga a decidir cuándo y cómo se asigna el número definitivo — buen momento para unificarlo.
- `saleLinks.generateToken` (`saleLinks.ts:33`) usa `Math.random()`, no `crypto.getRandomValues` como sí hace `contractFillTokens.ts:104`. Token de acceso a datos personales: debe migrarse.
- Los `saleLinks.token` **no expiran** (a diferencia de los fill tokens, 48 h).
- `contractFillTokens` es un **sistema huérfano completo**: `createToken`, `fillToken`, `getPublicDealByToken` no tienen ningún caller. Además `contract-detail-modal.tsx:451` enlaza a `/contrato/{token}`, **ruta que no existe**. Es un remanente de `fincasya-new`.
- `contracts.list` (`contracts.ts:332`) hace dos `take(5000)` y filtra en memoria.
