import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { checkinGuestFields } from './lib/checkinGuest';

/**
 * FincasYa v2 — schema.
 * Tablas heredadas del sistema anterior (datos importados el 2026-07-10) +
 * tablas nuevas del agente (exemplars curados, etiquetas de curacion, dedup YCloud).
 * Nota: las tablas de Better Auth (user/session/account/verification/jwks) NO
 * viven aqui — son del storage aislado del componente `betterAuth` (ver
 * convex/betterAuth/schema.ts), accesibles solo vía `authComponent`/`components.betterAuth`.
 * Las tablas importadas que no aparecen aqui (contracts, payments, reviews, etc.)
 * siguen en la base sin validacion de schema; se declaran cuando el codigo las use.
 */
export default defineSchema(
  {
    contacts: defineTable({
      phone: v.string(),
      name: v.string(),
      email: v.optional(v.string()),
      cedula: v.optional(v.string()),
      city: v.optional(v.string()),
      /**
       * Dirección de residencia (cuando el cliente la dio en el contrato). Se
       * usa para auto-enriquecer el contacto en el CRM cuando el bot completa
       * el paquete de datos del contrato (vía `contacts.upsertFromContractData`).
       */
      address: v.optional(v.string()),
      /** Lead: en seguimiento. Cliente: ya con reserva o relación comercial. */
      crmType: v.optional(v.union(v.literal('lead'), v.literal('client'))),
      lastReservationAt: v.optional(v.number()),
      /**
       * Consentimiento de tratamiento de datos (Ley 1581) recogido por WhatsApp
       * vía la plantilla `tratamiento_de_datos`. Solo se pide UNA vez por usuario:
       *   - `undefined`: nunca se ha pedido / sin respuesta todavía.
       *   - `granted`: el usuario respondió "Sí, autorizo" → el bot puede operar.
       *   - `denied`: respondió "No autorizo" → el bot queda en pausa.
       */
      dataConsentStatus: v.optional(
        v.union(v.literal('granted'), v.literal('denied')),
      ),
      /** Momento (ms) en que el usuario respondió a la solicitud de consentimiento. */
      dataConsentAt: v.optional(v.number()),
      /**
       * Momento (ms) del último envío de la plantilla de consentimiento. Evita
       * reenviarla en bucle si el usuario escribe varias veces antes de responder.
       */
      dataConsentRequestedAt: v.optional(v.number()),
      /**
       * Nombre BASE del contacto (el original del perfil de WhatsApp / panel).
       * Se preserva cuando `name` se enriquece con el contexto del deal en
       * curso. Si está vacío, el name no se ha enriquecido todavía.
       */
      baseName: v.optional(v.string()),
      /**
       * Etiqueta de deal pegada al nombre cuando el bot ya tiene contexto
       * comercial significativo: finca elegida + cupo (+ fechas). Ej.:
       * "Quinta Montebello · 15pax · 07-08→10-08". El inbox lo muestra así:
       * `name = baseName + " · " + dealLabel`. Cuando se cierra el deal se
       * limpia y `crmType` pasa a 'client'.
       */
      dealLabel: v.optional(v.string()),
      /** Fecha de nacimiento (ISO yyyy-MM-dd), capturada en check-in. */
      fechaNacimiento: v.optional(v.string()),
      /** Fotos de cédula subidas desde el link de contrato (frente/reverso). */
      cedulaPhotoUrls: v.optional(v.array(v.string())),
      /** Notas libres del Experto sobre el cliente (panel "Info. del contacto"). */
      notes: v.optional(v.string()),
      /** Foto de perfil del cliente asignada desde el inbox. */
      photoUrl: v.optional(v.string()),
      /**
       * Detección de propietario (se calcula UNA sola vez, la primera vez que
       * el contacto escribe). Si el teléfono coincide con el de un propietario
       * registrado (`propertyOwnerInfo.propietarioTelefono`), se atiende
       * distinto: saludo especial + escalado directo a un Experto.
       */
      ownerChecked: v.optional(v.boolean()),
      isOwner: v.optional(v.boolean()),
      ownerName: v.optional(v.string()),
      ownerTratamiento: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index('by_phone', ['phone'])
      .index('by_cedula', ['cedula']),


    conversations: defineTable({
      contactId: v.id('contacts'),
      channel: v.union(v.literal('whatsapp'), v.literal('web')),
      /** ai = responde la IA; human = solo humano; resolved = cerrada */
      status: v.union(v.literal('ai'), v.literal('human'), v.literal('resolved')),
      /**
       * Estado operativo del embudo (visible en inbox). Extensible añadiendo literales + migración.
       * Default lógico: pending_data.
       */
      operationalState: v.optional(
        v.union(
          v.literal('requires_advisor'),
          v.literal('validate_availability'),
          v.literal('ready_to_book'),
          v.literal('pending_payment'),
          v.literal('pending_data'),
        ),
      ),
      /** Prioridad para el inbox: urgente, baja, media, resuelto */
      priority: v.optional(
        v.union(
          v.literal('urgent'),
          v.literal('low'),
          v.literal('medium'),
          v.literal('resolved'),
        ),
      ),
      lastMessageAt: v.optional(v.number()),
      /** Últimas fincas enviadas en catálogo (para "otras opciones") */
      lastSentCatalogPropertyIds: v.optional(v.array(v.id('properties'))),
      /** Filtros de la última búsqueda que envió catálogo (para repetir con otras fincas) */
      lastCatalogSearch: v.optional(
        v.object({
          location: v.string(),
          fechaEntrada: v.number(),
          fechaSalida: v.number(),
          minCapacity: v.optional(v.number()),
          sortByPrice: v.optional(v.boolean()),
          hasPets: v.optional(v.boolean()),
        }),
      ),
      createdAt: v.number(),
      attended: v.optional(v.boolean()),
      /** Convex `user._id` del Experto asignado (inbox). */
      assignedUserId: v.optional(v.string()),
      /**
       * Etiquetas de negocio (inbox): varias por conversación; strings libres
       * (predefinidas en UI + personalizadas).
       */
      tags: v.optional(v.array(v.string())),
      /**
       * Mensajes del cliente sin marcar como leídos en el panel (incrementa con
       * cada mensaje `user`; se pone a 0 al abrir/marcar leído).
       */
      inboxUnreadCount: v.optional(v.number()),
      /** Última vez que un Experto abrió/marcó leída la conversación en inbox. */
      inboxLastReadAt: v.optional(v.number()),
      /**
       * true = un Experto activo el bot manualmente en el panel; el bot responde
       * aunque ya haya catalogo/proceso. false/undefined = solo auto en chats nuevos.
       */
      aiManualOverride: v.optional(v.boolean()),
      /** Listas/etiquetas asignadas a la conversación (estilo WhatsApp Business). */
      labelIds: v.optional(v.array(v.id('labels'))),
      /** El contacto es un propietario registrado (no cliente). */
      isOwner: v.optional(v.boolean()),
      /** Ya se envió el saludo de propietario + escalado en esta conversación. */
      ownerGreeted: v.optional(v.boolean()),
      /** Fijada arriba en el inbox (clic derecho → Fijar). */
      pinned: v.optional(v.boolean()),
      /** Archivada: oculta del listado principal (clic derecho → Archivar). */
      archived: v.optional(v.boolean()),
      /** Eliminada desde el panel (soft delete). Oculta definitivamente del inbox. */
      deletedAt: v.optional(v.number()),
    })
      .index('by_contact', ['contactId'])
      .index('by_status', ['status'])
      .index('by_priority', ['priority'])
      .index('by_last_message', ['lastMessageAt'])
      .index('by_operational_state', ['operationalState'])
      .index('by_assigned_user', ['assignedUserId']),

    /** Listas/etiquetas del inbox (nombre + color + emoji), estilo WhatsApp Business. */
    labels: defineTable({
      name: v.string(),
      /** Color hex (ej. "#21c063"). */
      color: v.string(),
      /** Emoji opcional para la lista. */
      emoji: v.optional(v.string()),
      order: v.optional(v.number()),
      createdAt: v.number(),
    }),

    /** Respuestas rápidas del Experto (atajos "/gracias", "/horario", …). */
    quickReplies: defineTable({
      /** Atajo sin la barra (ej. "gracias"). Único. */
      shortcut: v.string(),
      /** Texto que se inserta al elegir la respuesta. */
      message: v.string(),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }).index('by_shortcut', ['shortcut']),

    messages: defineTable({
      conversationId: v.id('conversations'),
      /** system = solo inbox (alertas internas); no se envía a WhatsApp. */
      sender: v.union(
        v.literal('user'),
        v.literal('assistant'),
        v.literal('system'),
      ),
      content: v.string(),
      /** Tipo de mensaje: texto (default), imagen, audio, video, documento */
      type: v.optional(
        v.union(
          v.literal('text'),
          v.literal('image'),
          v.literal('audio'),
          v.literal('video'),
          v.literal('document'),
          v.literal('product'),
        ),
      ),
      /** URL de media cuando type es image/audio/document */
      mediaUrl: v.optional(v.string()),
      /** Nombre original del archivo (documentos/media) para mostrar en el chat. */
      mediaFilename: v.optional(v.string()),
      /** MIME del archivo (image/jpeg, application/pdf, audio/ogg, …). */
      mediaMime: v.optional(v.string()),
      /** Tamaño del archivo en bytes (para mostrar "PDF · 240 KB"). */
      mediaSize: v.optional(v.number()),
      /** Metadatos del mensaje (ej: para catálogos, datos de finca) */
      metadata: v.optional(v.any()),
      createdAt: v.number(),
      /** Convex user._id del Experto que envió el mensaje manualmente (trazabilidad). */
      sentByUserId: v.optional(v.string()),
      /** wamid de WhatsApp (mensajes salientes) para actualizar estado vía webhook. */
      wamid: v.optional(v.string()),
      /**
       * Estado de entrega/lectura en WhatsApp (solo mensajes `assistant` enviados por WA).
       * Orden: accepted → sent → delivered → read.
       */
      whatsappStatus: v.optional(
        v.union(
          v.literal('failed'),
          v.literal('accepted'),
          v.literal('sent'),
          v.literal('delivered'),
          v.literal('read'),
        ),
      ),
      /** Oculto en inbox (eliminar). */
      deletedAt: v.optional(v.number()),
      /** Última edición del contenido. */
      editedAt: v.optional(v.number()),
      /** Emoji de reacción sobre ESTE mensaje (última reacción; vacío = sin reacción). */
      reaction: v.optional(v.string()),
      /** wamid del mensaje citado (cuando este mensaje es respuesta a otro). */
      replyToWamid: v.optional(v.string()),
      /** Transcripción de la nota de voz (bajo demanda desde el inbox). */
      transcription: v.optional(v.string()),
    })
      .index('by_conversation', ['conversationId', 'createdAt'])
      .index('by_wamid', ['wamid']),


    properties: defineTable({
      title: v.string(),
      description: v.string(),
      location: v.string(),
      /** Departamentos de Colombia donde se ubica o comercializa la finca (multi-select). */
      departamentos: v.optional(v.array(v.string())),
      capacity: v.number(),
      /**
       * Máximo de personas para evento/celebración (invitados totales), puede ser mayor que `capacity`
       * (hospedaje). Solo aplica si `allowsEventsContent === true` y el cliente busca con evento.
       */
      eventCapacity: v.optional(v.number()),
      /**
       * Precio de referencia en COP para evento/celebración hasta `eventCapacity` invitados
       * (orientador para bot y catálogo; opcional).
       */
      eventPackagePrice: v.optional(v.number()),
      rating: v.optional(v.number()),
      reviewsCount: v.optional(v.number()),
      video: v.optional(v.string()),
      lat: v.number(),
      lng: v.number(),
      priceBase: v.number(),
      /** Precio original antes de descuentos/promos (legacy, usado para catálogos). */
      priceOriginal: v.optional(v.number()),
      priceBaja: v.number(),
      priceMedia: v.number(),
      priceAlta: v.number(),
      priceEspeciales: v.optional(v.number()),
      priceRawBase: v.optional(v.string()),
      priceRawBaja: v.optional(v.string()),
      priceRawMedia: v.optional(v.string()),
      priceRawAlta: v.optional(v.string()),
      priceRawEspeciales: v.optional(v.string()),
      code: v.optional(v.string()),
      slug: v.optional(v.string()),
      category: v.union(
        v.literal('ECONOMICA'),
        v.literal('ESTANDAR'),
        v.literal('PREMIUM'),
        v.literal('LUJO'),
        v.literal('ECOTURISMO'),
        v.literal('CON_PISCINA'),
        v.literal('CERCA_BOGOTA'),
        v.literal('GRUPOS_GRANDES'),
        v.literal('VIP'),
      ),
      type: v.union(
        v.literal('FINCA'),
        v.literal('CASA_CAMPESTRE'),
        v.literal('VILLA'),
        v.literal('HACIENDA'),
        v.literal('QUINTA'),
        v.literal('APARTAMENTO'),
        v.literal('CASA'),
        v.literal('CASA_PRIVADA'),
        v.literal('CASA_EN_CONJUNTO_CERRADO'),
        v.literal('VILLA_PRIVADA'),
        v.literal('CONDOMINIO'),
        v.literal('CASA_BOUTIQUE'),
        v.literal('YATE'),
        v.literal('ISLA'),
        v.literal('GLAMPING'),
      ),
      /** Si true, la finca aparece en el listado público. */
      visible: v.optional(v.boolean()),
      /** Si false, la finca está desactivada y no se muestra en la web principal. Default true. */
      active: v.optional(v.boolean()),
      /** Si true, se puede reservar desde la página web. */
      reservable: v.optional(v.boolean()),
      /**
       * Si false, la finca no se incluye cuando el bot envía catálogos por Meta/WhatsApp.
       * Sigue visible en la web pero solo como ficha informativa (sin reserva en línea).
       */
      visibleInWhatsAppCatalog: v.optional(v.boolean()),
      /** Si true, aparece en /marketplace (fincas en venta) y el detalle ofrece contacto por WhatsApp. */
      marketplaceForSale: v.optional(v.boolean()),
      /** Valor de venta de referencia en COP (marketplace). */
      salePriceCop: v.optional(v.number()),
      /** Metros cuadrados construidos o del lote (marketplace / modo venta). */
      saleSquareMeters: v.optional(v.number()),
      /** Descripción comercial para venta (distinta del texto de arriendo). */
      saleDescription: v.optional(v.string()),
      /** URL de la plantilla del contrato en PDF. */
      contractTemplateUrl: v.optional(v.string()),
      /**
       * Datos de contacto del propietario y del encargado de la finca (spec §6).
       * El encargado es una persona distinta del propietario que también recibe
       * comunicaciones (recordatorios de llegada). Teléfonos en formato E.164.
       */
      propietarioNombre: v.optional(v.string()),
      /** Tratamiento para el saludo en mensajes: 'Sr' | 'Sra'. */
      propietarioTratamiento: v.optional(v.string()),
      propietarioTelefono: v.optional(v.string()),
      propietarioCedula: v.optional(v.string()),
      propietarioCorreo: v.optional(v.string()),
      encargadoNombre: v.optional(v.string()),
      encargadoTelefono: v.optional(v.string()),
      /** Reglas de salida (check-out) específicas de esta finca. Override del texto global. */
      checkoutRulesText: v.optional(v.string()),
      /**
       * Etiquetas de filtros del sitio (pestañas del home): luxury, eventos, cerca-bogota, melgar, etc.
       * Si el campo falta, la web usa reglas legacy por ubicación/texto. Si existe (puede ser []), aplica modo explícito.
       */
      catalogFilterTags: v.optional(v.array(v.string())),
      /** Bandera legacy para favoritos (para compatibilidad con documentos existentes). */
      isFavorite: v.optional(v.boolean()),
      /** Lista de IDs de la iconografía para mostrar en la card de la finca (máximo 4). */
      featuredIcons: v.optional(v.array(v.id('iconography'))),
      /** Lista ordenada de nombres de zonas para renderizado. */
      zoneOrder: v.optional(v.array(v.string())),
      /** Si true, la finca permite mascotas. */
      allowsPets: v.optional(v.boolean()),
      /**
       * Si true (por defecto), el check-in exige listado de invitados para el
       * propietario y el turista. Algunas fincas no requieren ese listado.
       */
      requiresGuestList: v.optional(v.boolean()),
      /** Si true, se permite bafles, sonido profesional o decoración para eventos. */
      allowsEventsContent: v.optional(v.boolean()),
      /** Si true, la finca solo permite estadías exclusivamente para descanso familiar. */
      familyOnly: v.optional(v.boolean()),
      /** Si true, la finca tiene personal de servicio disponible para contratación. */
      serviceStaffAvailable: v.optional(v.boolean()),
      /** Si true, el personal de servicio es obligatorio para la finca. */
      serviceStaffMandatory: v.optional(v.boolean()),
      /** Precio por estadía del personal de servicio. */
      serviceStaffPrice: v.optional(v.number()),
      /**
       * Depósito reembolsable por daños a la propiedad (COP). Se muestra en el
       * resumen del chat y se precarga al generar contrato.
       */
      depositoDanosReembolsable: v.optional(v.number()),
      /**
       * Valor de la manilla de ingreso al condominio (COP). Aplica a fincas en
       * conjunto cerrado / condominio.
       */
      manillaCondominio: v.optional(v.number()),
      /**
       * Auxilio de aseo final (COP), cobro único por estadía. Se incluye en la
       * descripción, chat y precarga de contratos.
       */
      depositoAseo: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_location', ['location'])
      .index('by_capacity', ['capacity'])
      .index('by_rating', ['rating'])
      .index('by_type', ['type'])
      .index('by_category', ['category'])
      .index('by_code', ['code'])
      .index('by_slug', ['slug'])
      .index('by_createdAt', ['createdAt']),


    propertyImages: defineTable({
      propertyId: v.id('properties'),
      url: v.string(),
      order: v.optional(v.number()),
    }).index('by_property', ['propertyId']),

    /**
     * Catálogo global de iconografía (amenidades): nombre, SVG en S3 (`iconUrl`)
     * y/o `emoji`. Fue migrada desde fincasya-new; `propertyFeatures.iconId`
     * apunta a estos documentos.
     */
    iconography: defineTable({
      name: v.optional(v.string()),
      iconUrl: v.optional(v.string()),
      emoji: v.optional(v.string()),
      createdAt: v.optional(v.number()),
      updatedAt: v.optional(v.number()),
    }).index('by_name', ['name']),

    /**
     * Características/amenidades de cada finca (portado de fincasya-new).
     * `iconId` referencia el catálogo global `iconography` (guardado como texto:
     * puede venir vacío en features sin icono). `zoneTemplateSourceId` se guarda
     * como texto: en `prueba` no existen las plantillas de zona.
     */
    propertyFeatures: defineTable({
      propertyId: v.id('properties'),
      name: v.string(),
      iconId: v.optional(v.string()),
      featureId: v.optional(v.string()),
      quantity: v.optional(v.number()),
      zone: v.optional(v.string()),
      zoneTemplateSourceId: v.optional(v.string()),
    })
      .index('by_property', ['propertyId'])
      .index('by_icon', ['iconId']),

    propertyCategoryZoneTemplates: defineTable({
      propertyCategory: v.union(
        v.literal('ECONOMICA'),
        v.literal('ESTANDAR'),
        v.literal('PREMIUM'),
        v.literal('LUJO'),
        v.literal('ECOTURISMO'),
        v.literal('CON_PISCINA'),
        v.literal('CERCA_BOGOTA'),
        v.literal('GRUPOS_GRANDES'),
        v.literal('VIP'),
      ),
      name: v.string(),
      order: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index('by_category', ['propertyCategory']),

    propertyCategoryZoneFeatures: defineTable({
      zoneTemplateId: v.id('propertyCategoryZoneTemplates'),
      iconographyId: v.id('iconography'),
      alias: v.optional(v.string()),
      quantity: v.optional(v.number()),
      order: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_zone_template', ['zoneTemplateId'])
      .index('by_iconography', ['iconographyId']),

    adminContractSnapshots: defineTable({
      contractNumber: v.string(),
      propertyId: v.id('properties'),
      payload: v.any(),
      createdAt: v.number(),
    }).index('by_contract_number', ['contractNumber']),

    adminContractSettings: defineTable({
      scope: v.literal('global'),
      payload: v.any(),
      updatedAt: v.number(),
    }).index('by_scope', ['scope']),

    contracts: defineTable({
      contractNumber: v.string(),
      propertyId: v.optional(v.id('properties')),
      propertyTitle: v.optional(v.string()),
      propertyLocation: v.optional(v.string()),
      clienteNombre: v.optional(v.string()),
      clienteCedula: v.optional(v.string()),
      clienteEmail: v.optional(v.string()),
      clienteTelefono: v.optional(v.string()),
      clienteCiudad: v.optional(v.string()),
      clienteDireccion: v.optional(v.string()),
      firmanteNombre: v.optional(v.string()),
      firmanteCedula: v.optional(v.string()),
      valorTotal: v.optional(v.number()),
      fechaEntrada: v.optional(v.string()),
      fechaSalida: v.optional(v.string()),
      pdfUrl: v.optional(v.string()),
      pdfFilename: v.optional(v.string()),
      confirmationPdfUrl: v.optional(v.string()),
      confirmationPdfFilename: v.optional(v.string()),
      estado: v.string(),
      origen: v.optional(v.string()),
      bookingId: v.optional(v.id('bookings')),
      // Guardado como texto: los contratos migrados de fincasya-new traen ids de
      // fill-token que no siempre resuelven a un doc de `contractFillTokens` en
      // este deployment (referencia cross-tabla del import). Ver mismo patrón en
      // propertyFeatures.iconId.
      fillTokenId: v.optional(v.string()),
      draftJson: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_contract_number', ['contractNumber'])
      .index('by_status', ['estado'])
      .index('by_created', ['createdAt'])
      .index('by_property', ['propertyId']),

    contractFillTokens: defineTable({
      token: v.string(),
      conversationId: v.optional(v.id('conversations')),
      source: v.optional(v.union(v.literal('inbox'), v.literal('admin'))),
      contractDraftJson: v.optional(v.string()),
      contractSettingsJson: v.optional(v.string()),
      propertyMetaJson: v.optional(v.string()),
      propertyTitle: v.optional(v.string()),
      propertyLocation: v.optional(v.string()),
      fechaEntrada: v.optional(v.string()),
      fechaSalida: v.optional(v.string()),
      cupo: v.optional(v.number()),
      precioTotal: v.optional(v.number()),
      expiresAt: v.number(),
      status: v.union(
        v.literal('pending'),
        v.literal('filled'),
        v.literal('expired'),
      ),
      filledData: v.optional(v.any()),
      filledDataJson: v.optional(v.string()),
      contractNumber: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index('by_token', ['token'])
      .index('by_conversation', ['conversationId']),

    saleLinks: defineTable({
      token: v.string(),
      contractCode: v.optional(v.string()),
      propertyId: v.id('properties'),
      createdBy: v.string(),
      createdByName: v.optional(v.string()),
      checkIn: v.number(),
      checkOut: v.number(),
      nights: v.number(),
      guests: v.number(),
      checkInTime: v.optional(v.string()),
      checkOutTime: v.optional(v.string()),
      totalValue: v.number(),
      rentalValue: v.number(),
      depositAmount: v.number(),
      cleaningFee: v.number(),
      petDeposit: v.optional(v.number()),
      petSurcharge: v.optional(v.number()),
      petCount: v.optional(v.number()),
      selectedBankAccountIds: v.array(v.string()),
      notes: v.optional(v.string()),
      clientStep: v.number(),
      clientPortalUiStep: v.optional(v.number()),
      clientDraftPhase: v.optional(
        v.union(v.literal('datos'), v.literal('pago')),
      ),
      clientDraftPaymentAmount: v.optional(v.number()),
      status: v.union(
        v.literal('active'),
        v.literal('completed'),
        v.literal('cancelled'),
      ),
      clientData: v.optional(
        v.object({
          nombre: v.string(),
          cedula: v.string(),
          email: v.string(),
          telefono: v.string(),
          direccion: v.string(),
          ciudad: v.optional(v.string()),
          fechaNacimiento: v.optional(v.string()),
          cedulaPhotoUrl: v.optional(v.string()),
          cedulaPhotoFileName: v.optional(v.string()),
          cedulaPhotoMimeType: v.optional(v.string()),
          filledAt: v.number(),
        }),
      ),
      paymentProofUrl: v.optional(v.string()),
      paymentProofFileName: v.optional(v.string()),
      paymentProofMimeType: v.optional(v.string()),
      paymentProofAmount: v.optional(v.number()),
      paymentProofSubmittedAt: v.optional(v.number()),
      paymentProofs: v.optional(
        v.array(
          v.object({
            url: v.string(),
            fileName: v.optional(v.string()),
            mimeType: v.optional(v.string()),
            amount: v.optional(v.number()),
            submittedAt: v.number(),
          }),
        ),
      ),
      paymentValidationKey: v.optional(v.string()),
      paymentValidated: v.optional(v.boolean()),
      paymentValidatedAt: v.optional(v.number()),
      paymentValidatedBy: v.optional(v.string()),
      contractUrl: v.optional(v.string()),
      contractGeneratedAt: v.optional(v.number()),
      signedContractUrl: v.optional(v.string()),
      signedContractFileName: v.optional(v.string()),
      signedContractSubmittedAt: v.optional(v.number()),
      crUrl: v.optional(v.string()),
      crGeneratedAt: v.optional(v.number()),
      bookingId: v.optional(v.id('bookings')),
      ownerOfferAmount: v.optional(v.number()),
      ownerOfferSentAt: v.optional(v.number()),
      ownerOfferAcceptedAt: v.optional(v.number()),
      ownerOfferRejectedAt: v.optional(v.number()),
      ownerOfferRejectedReason: v.optional(v.string()),
      ownerOfferComment: v.optional(v.string()),
      ownerOfferCommentAt: v.optional(v.number()),
      checkinGuests: v.optional(v.array(v.object(checkinGuestFields))),
      checkinMenoresDe2: v.optional(v.number()),
      checkinMascotas: v.optional(v.number()),
      checkinPlacas: v.optional(v.string()),
      checkinObservaciones: v.optional(v.string()),
      checkinCompleted: v.optional(v.boolean()),
      checkinCompletedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_token', ['token'])
      .index('by_contract_code', ['contractCode'])
      .index('by_property', ['propertyId'])
      .index('by_created_by', ['createdBy'])
      .index('by_status', ['status'])
      .index('by_booking', ['bookingId']),

    /** Datos del propietario, cuentas bancarias y check-in (portado de fincasya-new). */
    /** Orden manual de fincas por pestaña del home (/admin/reorder). */
    tabOrders: defineTable({
      tabId: v.string(), // ej. "melgar", "cerca-bogota", "favoritas", "todas"
      propertyIds: v.array(v.id('properties')),
      updatedAt: v.number(),
    }).index('by_tab', ['tabId']),

    propertyOwnerInfo: defineTable({
      propertyId: v.id('properties'),
      ownerUserId: v.string(),
      rutNumber: v.string(),
      bankName: v.string(),
      accountNumber: v.string(),
      bankAccounts: v.optional(
        v.array(
          v.object({
            id: v.string(),
            bankName: v.string(),
            accountNumber: v.string(),
            accountType: v.optional(v.string()),
            accountHolderName: v.optional(v.string()),
            brebKey: v.optional(v.boolean()),
          }),
        ),
      ),
      rntNumber: v.string(),
      propietarioNombre: v.optional(v.string()),
      propietarioTratamiento: v.optional(v.string()),
      propietarioTelefono: v.optional(v.string()),
      propietarioCedula: v.optional(v.string()),
      propietarioCorreo: v.optional(v.string()),
      checkinUbicacionUrl: v.optional(v.string()),
      checkinWazeUrl: v.optional(v.string()),
      checkinIndicacionesLlegada: v.optional(v.string()),
      checkinRecomendaciones: v.optional(v.string()),
      checkinUbicacionImageUrl: v.optional(v.string()),
      checkinUbicacionImageUrls: v.optional(v.array(v.string())),
      bankCertificationUrl: v.optional(v.string()),
      idCopyUrl: v.optional(v.string()),
      rntPdfUrl: v.optional(v.string()),
      chamberOfCommerceUrl: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_property', ['propertyId'])
      .index('by_owner', ['ownerUserId']),


    propertyPricing: defineTable({
      propertyId: v.id('properties'),
      /** ID de la regla global (opcional). Si existe, los datos de nombre/fechas pueden heredarse. */
      globalRuleId: v.optional(v.id('globalPricing')),
      nombre: v.string(),
      fechaDesde: v.optional(v.string()),
      fechaHasta: v.optional(v.string()),
      fechas: v.optional(v.array(v.string())),
      /** Precio base (usado cuando no hay sub-reglas de capacidad) */
      valorUnico: v.optional(v.number()),
      condiciones: v.optional(v.string()),
      /** Si true, el cliente final ve esta temporada; el admin puede activar/desactivar */
      activa: v.optional(v.boolean()),
      /** JSON: reglas de la temporada (rangos fechas, días semana, mín noches, excepciones, descripción) */
      reglas: v.optional(v.string()),
      order: v.optional(v.number()),
      /** Sub-reglas de precio por capacidad (cada una con su propio precio) */
      subReglasCapacidad: v.optional(
        v.array(
          v.object({
            capacidadMin: v.number(),
            capacidadMax: v.number(),
            valorUnico: v.number(),
          }),
        ),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_property', ['propertyId'])
      .index('by_global_rule', ['globalRuleId']),


    propertyAvailability: defineTable({
      propertyId: v.id('properties'),
      bookingId: v.optional(v.id('bookings')),
      fechaEntrada: v.number(),
      fechaSalida: v.number(),
      blocked: v.optional(v.boolean()),
      reason: v.optional(v.string()),
      googleEventId: v.optional(v.string()),
    })
      .index('by_property', ['propertyId'])
      .index('by_dates', ['fechaEntrada', 'fechaSalida'])
      .index('by_booking', ['bookingId']),


    globalPricing: defineTable({
      nombre: v.string(),
      /** Formato: MM-DD (ej: 04-01 para 1ro de abril). Independiente del año. */
      fechaDesde: v.optional(v.string()),
      fechaHasta: v.optional(v.string()),
      /** Lista de fechas específicas en formato MM-DD. */
      fechas: v.optional(v.array(v.string())),
      activa: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index('by_nombre', ['nombre']),


    bookings: defineTable({
      propertyId: v.id('properties'),
      userId: v.optional(v.id('contacts')),
      nombreCompleto: v.string(),
      cedula: v.string(),
      celular: v.string(),
      correo: v.string(),
      fechaEntrada: v.number(),
      fechaSalida: v.number(),
      horaEntrada: v.optional(v.string()), // Ej: "15:00"
      horaSalida: v.optional(v.string()), // Ej: "11:00"
      address: v.optional(v.string()),
      numeroNoches: v.number(),
      numeroPersonas: v.number(),
      personasAdicionales: v.optional(v.number()),
      tieneMascotas: v.optional(v.boolean()),
      numeroMascotas: v.optional(v.number()),
      detallesMascotas: v.optional(v.string()),
      subtotal: v.number(),
      costoPersonasAdicionales: v.optional(v.number()),
      costoMascotas: v.optional(v.number()),
      depositoMascotas: v.optional(v.number()),
      sobrecargoMascotas: v.optional(v.number()),
      costoPersonalServicio: v.optional(v.number()),
      depositoGarantia: v.optional(v.number()),
      depositoAseo: v.optional(v.number()),
      discountCode: v.optional(v.string()),
      discountAmount: v.optional(v.number()),
      /** Fecha de emisión del contrato / confirmación (yyyy-MM-dd). */
      issueDate: v.optional(v.string()),
      /**
       * Novedades económicas: incrementos o descuentos sobre el valor base
       * (alquiler + limpieza + depósito). precioTotal = base + ajustes.
       */
      economicAdjustments: v.optional(
        v.array(
          v.object({
            id: v.string(),
            date: v.string(),
            description: v.string(),
            amount: v.number(),
            type: v.union(v.literal('INCREMENT'), v.literal('DISCOUNT')),
            createdBy: v.optional(v.string()),
            createdAt: v.number(),
          }),
        ),
      ),
      precioTotal: v.number(),
      currency: v.optional(v.string()),
      temporada: v.string(),
      status: v.union(
        v.literal('PENDING'),
        v.literal('PENDING_PAYMENT'),
        v.literal('CONFIRMED'),
        v.literal('PAID'),
        v.literal('CANCELLED'),
        v.literal('COMPLETED'),
      ),
      paymentStatus: v.union(
        v.literal('PENDING'),
        v.literal('PARTIAL'),
        v.literal('PAID'),
        v.literal('REFUNDED'),
      ),
      transactionId: v.optional(v.string()),
      reference: v.optional(v.string()),
      /** Reserva originada en un link de venta (/venta/:token). */
      saleLinkId: v.optional(v.id('saleLinks')),
      /** El propietario aceptó el valor ofrecido en /anfitrion. */
      ownerOfferAcceptedAt: v.optional(v.number()),
      /** El propietario rechazó la oferta en /anfitrion. */
      ownerOfferRejectedAt: v.optional(v.number()),
      ownerOfferRejectedReason: v.optional(v.string()),
      /** Observación del propietario sin rechazar (sigue pendiente). */
      ownerOfferComment: v.optional(v.string()),
      ownerOfferCommentAt: v.optional(v.number()),
      observaciones: v.optional(v.string()),
      city: v.optional(v.string()),
      purpose: v.optional(v.string()),
      groupType: v.optional(v.string()),
      isEvento: v.optional(v.boolean()),
      detallesEvento: v.optional(
        v.union(
          v.null(),
          v.object({
            extraSound: v.optional(v.string()),
            liveMusic: v.optional(v.string()),
            dj: v.optional(v.string()),
            decoration: v.optional(v.string()),
            additionalGuests: v.optional(v.string()),
          }),
        )
      ),
      isDirect: v.optional(v.boolean()),
      isDirectBooking: v.optional(v.boolean()),
      googleEventId: v.optional(v.string()),
      googleCalendarId: v.optional(v.string()),
      /**
       * Etiqueta/código que reemplaza el prefijo "Reserva:" en el título del
       * evento de Google Calendar. Si está vacío, no se antepone nada.
       */
      calendarLabel: v.optional(v.string()),
      multimedia: v.optional(
        v.array(
          v.object({
            url: v.string(),
            name: v.string(),
            type: v.string(),
            size: v.optional(v.number()),
            uploadedAt: v.optional(v.number()),
          }),
        ),
      ),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
      reminderSent: v.optional(v.boolean()),
      /**
       * Check-in del turista completado (spec §4/§5). Lo marca el portal de
       * check-in o el equipo (check-in manual). Se usa para filtrar a quién
       * recordarle el check-in pendiente (no molestar a quien ya lo hizo).
       */
      checkinCompleted: v.optional(v.boolean()),
      checkinCompletedAt: v.optional(v.number()),
      /**
       * Override manual del equipo: si es true, la lista de invitados se puede
       * editar aunque ya esté dentro de la ventana de bloqueo (24/12 h antes).
       */
      guestListUnlocked: v.optional(v.boolean()),
      /**
       * Marca manual: el equipo envió el check-in al cliente (ej. copió el
       * mensaje). Lleva la reserva a la etapa "morado / check-in enviado" en
       * el semáforo del calendario, sin esperar un envío automático.
       */
      checkinSentManualAt: v.optional(v.number()),
      /**
       * Lista de invitados que ingresan, capturada por el turista en el portal
       * público de check-in (`/checkin/:reference`). Cada persona mayor de 2 años
       * lleva nombre completo + cédula; los menores de 2 años se marcan con
       * `esMenor` y no requieren cédula. Se permite guardado parcial (el turista
       * puede llenar unos hoy y los demás otro día con el mismo link).
       */
      checkinGuests: v.optional(v.array(v.object(checkinGuestFields))),
      /** El turista indicó que necesita empleada de servicio (portal de check-in). */
      checkinNeedsEmpleada: v.optional(v.boolean()),
      /** El turista indicó que necesita team (portal de check-in). */
      checkinNeedsTeam: v.optional(v.boolean()),
      /** Nota libre opcional sobre servicios (cantidad, horario, etc.). */
      checkinServiciosNota: v.optional(v.string()),
      /** Menores de 2 años (no cuentan para cupo ni van en `checkinGuests`). */
      checkinMenoresDe2: v.optional(v.number()),
      /** Mascotas indicadas/confirmadas por el huésped en el portal de check-in (0 = no van). */
      checkinMascotas: v.optional(v.number()),
      /** Placas de vehículos indicadas en el portal de check-in. */
      checkinPlacas: v.optional(v.string()),
      /** Solicitudes especiales del huésped en el portal de check-in. */
      checkinObservaciones: v.optional(v.string()),
      /** Consentimiento habeas data (Ley 1581) en el envío final del check-in. */
      checkinAceptaDatos: v.optional(v.boolean()),
      /** Última vez que el turista guardó avance o envió su check-in. */
      checkinUpdatedAt: v.optional(v.number()),
      /**
       * Check-out propietario (Fase 1). Observaciones/peticiones del cliente que el
       * equipo edita y comparte con el propietario; con log de cambios (quién/cuándo).
       */
      clientObservaciones: v.optional(v.string()),
      clientObservacionesUpdatedAt: v.optional(v.number()),
      clientObservacionesLog: v.optional(
        v.array(
          v.object({
            valor: v.string(),
            actor: v.string(),
            ts: v.number(),
          }),
        ),
      ),
      /**
       * Persona que recibe a los turistas el día de la llegada. La diligencia el
       * propietario desde su enlace público; el equipo la ve en el panel.
       */
      ownerReceiver: v.optional(
        v.object({
          nombre: v.optional(v.string()),
          contacto: v.optional(v.string()),
          updatedAt: v.optional(v.number()),
        }),
      ),
      /** Qué ve el propietario en /anfitrion/{ref} (lo configura el equipo admin). */
      ownerPortalShare: v.optional(
        v.object({
          showGuestList: v.optional(v.boolean()),
          showPlates: v.optional(v.boolean()),
          showEmpleada: v.optional(v.boolean()),
          showInternalNotes: v.optional(v.boolean()),
        }),
      ),
      /** Pago al propietario (check-out del propietario). */
      ownerPayout: v.optional(
        v.object({
          /** Valor total acordado con el propietario por esta reserva. */
          valorAcordado: v.optional(v.number()),
          /** Abono ya pagado al propietario. El saldo = valorAcordado - abono. */
          abono: v.optional(v.number()),
          valor: v.optional(v.number()),
          fecha: v.optional(v.string()),
          medio: v.optional(v.string()),
          comprobanteUrl: v.optional(v.string()),
          updatedAt: v.optional(v.number()),
          /** Abonos individuales al propietario (cada fila del reporte). */
          abonos: v.optional(
            v.array(
              v.object({
                id: v.string(),
                amount: v.number(),
                fecha: v.optional(v.string()),
                medio: v.optional(v.string()),
                comprobanteUrl: v.optional(v.string()),
                createdAt: v.number(),
                actor: v.optional(v.string()),
              }),
            ),
          ),
          log: v.optional(
            v.array(
              v.object({
                accion: v.string(),
                actor: v.string(),
                ts: v.number(),
              }),
            ),
          ),
        }),
      ),
      /**
       * Cuadro de rendimientos admin: casillas manuales (pagó, llegó, etc.).
       * true = sí, false = no, omitido = sin marcar.
       */
      reconciliationSheet: v.optional(
        v.object({
          turistaPago: v.optional(v.boolean()),
          turistaLlego: v.optional(v.boolean()),
          propietarioPago: v.optional(v.boolean()),
          checkinListo: v.optional(v.boolean()),
          notas: v.optional(v.string()),
          updatedAt: v.optional(v.number()),
          updatedBy: v.optional(v.string()),
        }),
      ),
      /**
       * Check-out del cliente (Fase 2+): devolución del depósito. Estado de la
       * validación + cuenta bancaria registrada por el cliente para la devolución.
       */
      depositReturn: v.optional(
        v.object({
          // pendiente_validacion | aprobado | rechazado | en_revision | devuelto
          estado: v.optional(v.string()),
          cuenta: v.optional(
            v.object({
              titular: v.optional(v.string()),
              tipo: v.optional(v.string()),
              numero: v.optional(v.string()),
              banco: v.optional(v.string()),
              documento: v.optional(v.string()),
              observaciones: v.optional(v.string()),
            }),
          ),
          /** Validación del propietario (admin en su nombre o el propietario por su enlace). */
          aprobacion: v.optional(
            v.object({
              por: v.optional(v.string()), // 'admin' | 'propietario'
              nombre: v.optional(v.string()),
              ts: v.optional(v.number()),
            }),
          ),
          /** Retención (rechazo o devolución parcial). */
          retencion: v.optional(
            v.object({
              motivo: v.optional(v.string()),
              obsPropietario: v.optional(v.string()),
              valorRetenido: v.optional(v.number()),
              evidencias: v.optional(v.array(v.string())),
            }),
          ),
          /** Registro del pago de devolución al cliente. */
          devolucion: v.optional(
            v.object({
              valor: v.optional(v.number()),
              fecha: v.optional(v.string()),
              medio: v.optional(v.string()),
              numTransaccion: v.optional(v.string()),
              observaciones: v.optional(v.string()),
              comprobanteUrl: v.optional(v.string()),
              registradoPor: v.optional(v.string()),
              ts: v.optional(v.number()),
            }),
          ),
          updatedAt: v.optional(v.number()),
          log: v.optional(
            v.array(
              v.object({
                accion: v.string(),
                actor: v.string(),
                ts: v.number(),
              }),
            ),
          ),
        }),
      ),
      /**
       * Portal público de pago (`/pago/:reference`): cuentas seleccionadas por el
       * equipo para mostrar al cliente en el link compartido.
       */
      paymentPortalConfig: v.optional(
        v.object({
          bankAccountIds: v.array(v.string()),
          paymentMediaIds: v.optional(v.array(v.string())),
          /**
           * Cuentas propias de ESTA reserva (importadas de un propietario). No están en
           * el catálogo global; solo afectan a esta reserva. Se resuelven junto al
           * catálogo global filtrando por bankAccountIds.
           */
          extraBankAccounts: v.optional(
            v.array(
              v.object({
                id: v.string(),
                bankName: v.string(),
                accountType: v.optional(v.string()),
                accountNumber: v.string(),
                ownerName: v.string(),
                ownerCedula: v.optional(v.string()),
                imageUrl: v.optional(v.string()),
                imageUrls: v.optional(v.array(v.string())),
                qrOnly: v.optional(v.boolean()),
                brebKey: v.optional(v.boolean()),
              }),
            ),
          ),
          /** Link de pago Bold (tarjeta de crédito) para esta reserva. */
          boldLink: v.optional(v.string()),
          /** Recargo % informativo junto al link de Bold (ej. 5). */
          boldSurcharge: v.optional(v.number()),
          updatedAt: v.number(),
        }),
      ),
      /** Soportes de pago subidos por el cliente desde el portal público. */
      paymentPortalReceipts: v.optional(
        v.array(
          v.object({
            id: v.string(),
            bankAccountId: v.optional(v.string()),
            bankName: v.optional(v.string()),
            amount: v.optional(v.number()),
            receiptUrl: v.string(),
            fileName: v.optional(v.string()),
            mimeType: v.optional(v.string()),
            status: v.union(
              v.literal('pending'),
              v.literal('approved'),
              v.literal('rejected'),
            ),
            submittedAt: v.number(),
            /** Revisión por el admin/representante legal. */
            reviewedAt: v.optional(v.number()),
            reviewedBy: v.optional(v.string()),
            /** Monto verificado al aprobar (puede diferir del reportado). */
            reviewedAmount: v.optional(v.number()),
            /** Motivo cuando status === 'rejected'. */
            rejectReason: v.optional(v.string()),
          }),
        ),
      ),
      /**
       * True si la reserva tiene algún soporte de pago PENDIENTE de revisar
       * (`paymentPortalReceipts` con status pending). Indexado para listar la
       * cola de revisión sin escanear toda la tabla.
       */
      hasPendingReceipt: v.optional(v.boolean()),
      /**
       * Etiqueta libre para agrupar reservas en envíos en lote (spec §10),
       * p. ej. "puente_festivo".
       */
      broadcastTag: v.optional(v.string()),
      /**
       * Bitácora de mensajes programados ya enviados, para dedupe por momento
       * del timeline (spec §3) y trazabilidad. `key` es la clave del momento
       * (ej. "tourist_checkin_start"), `recipient` el teléfono destino.
       */
      scheduledMessages: v.optional(
        v.array(
          v.object({
            key: v.string(),
            recipient: v.string(),
            sentAt: v.number(),
            wamid: v.optional(v.string()),
            status: v.optional(v.string()),
          }),
        ),
      ),
    })
      .index('by_property', ['propertyId'])
      .index('by_status', ['status'])
      .index('by_cedula', ['cedula'])
      .index('by_reference', ['reference'])
      .index('by_is_direct', ['isDirect'])
      .index('by_user', ['userId'])
      .index('by_dates', ['fechaEntrada', 'fechaSalida'])
      .index('by_pending_receipt', ['hasPendingReceipt']),


    whatsappCatalogs: defineTable({
      name: v.string(),
      /** ID del catálogo en Meta/WhatsApp (ej. 1560075992300705). */
      whatsappCatalogId: v.string(),
      /** Si true, se usa cuando no coincide ninguna ubicación (ej. "Todas las unidades"). */
      isDefault: v.optional(v.boolean()),
      /** Si la ubicación del usuario contiene esta palabra, se usa este catálogo (ej. "tolima"). */
      locationKeyword: v.optional(v.string()),
      order: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_name', ['name'])
      .index('by_location_keyword', ['locationKeyword'])
      .index('by_is_default', ['isDefault']),


    propertyWhatsAppCatalog: defineTable({
      propertyId: v.id('properties'),
      catalogId: v.id('whatsappCatalogs'),
      /** ID del producto (finca) en ese catálogo en Meta (identificador de contenido). */
      productRetailerId: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_property', ['propertyId'])
      .index('by_catalog', ['catalogId'])
      .index('by_property_and_catalog', ['propertyId', 'catalogId']),


    playbookExemplars: defineTable({
      /** Clave estable única (idempotencia con el RAG + edición). */
      key: v.string(),
      /** Fase del FSM ("welcome"…"done") o "any". */
      phase: v.string(),
      /** Descripción de la situación (se embebe para el match). */
      situation: v.string(),
      /** Frases típicas del cliente (mejoran el match). */
      clientExamples: v.array(v.string()),
      /** Respuesta modelo con el tono del equipo (lo que se inyecta). */
      response: v.string(),
      tags: v.array(v.string()),
      /** Si false, se conserva en la tabla pero se SACA del índice RAG. */
      enabled: v.boolean(),
      /** Origen: "seed" | "manual" | "conversation". */
      source: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_key', ['key'])
      .index('by_enabled', ['enabled']),

    /**
     * CAPA 2 — Ejemplares conversacionales curados (RAG).
     * Cada doc: situacion real de cliente -> respuesta modelo. Solo entran
     * pares provenientes de conversaciones exitosas (venta / cierre positivo)
     * o del playbook del equipo. El indice vectorial permite: mensaje nuevo
     * del cliente -> mejores respuestas historicas.
     */
    exemplars: defineTable({
      /** Mensaje del cliente (texto que se embebe para el match). */
      clientMessage: v.string(),
      /** Respuesta modelo (lo que se inyecta al prompt como ejemplo). */
      response: v.string(),
      /** Contexto breve de la situacion (fase del deal, si habia finca elegida, etc.). */
      situation: v.optional(v.string()),
      embedding: v.optional(v.array(v.float64())),
      /** true cuando embedding ya fue calculado (para el cron de reindexado). */
      embedded: v.boolean(),
      /** Por que se considera buen ejemplo: 'venta' | 'positiva' | 'playbook'. */
      quality: v.string(),
      /** Origen: 'historico' | 'playbook' | 'auto' (cron nocturno). */
      source: v.string(),
      /** Respuesta escrita por un Experto humano (mejor senal de calidad). */
      humanAuthored: v.boolean(),
      /** _id (string) de la conversacion de origen, si aplica. */
      sourceConversationId: v.optional(v.string()),
      enabled: v.boolean(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_embedded', ['embedded'])
      .index('by_source_conversation', ['sourceConversationId'])
      .vectorIndex('by_embedding', {
        vectorField: 'embedding',
        dimensions: 1536,
        filterFields: ['enabled'],
      }),

    /**
     * Resultado de la curacion por conversacion historica (trazabilidad del
     * pipeline). label: venta | positiva | neutra | problematica.
     */
    conversationLabels: defineTable({
      conversationId: v.id('conversations'),
      label: v.union(
        v.literal('venta'),
        v.literal('positiva'),
        v.literal('neutra'),
        v.literal('problematica'),
      ),
      /** Senales que justificaron la etiqueta (para auditar el pipeline). */
      reasons: v.array(v.string()),
      messageCount: v.number(),
      exemplarsCreated: v.number(),
      createdAt: v.number(),
    })
      .index('by_conversation', ['conversationId'])
      .index('by_label', ['label']),

    /** Dedup de eventos del webhook YCloud. */
    ycloudEvents: defineTable({
      eventId: v.string(),
      createdAt: v.number(),
    }).index('by_event', ['eventId']),

    /** Pagos asociados a reservas (abonos, saldos, reembolsos). */
    payments: defineTable({
      bookingId: v.id('bookings'),
      type: v.union(
        v.literal('ABONO_50'),
        v.literal('SALDO_50'),
        v.literal('COMPLETO'),
        v.literal('REEMBOLSO'),
      ),
      amount: v.number(),
      currency: v.optional(v.string()),
      transactionId: v.optional(v.string()),
      reference: v.optional(v.string()),
      paymentMethod: v.optional(v.string()),
      checkoutUrl: v.optional(v.string()),
      status: v.optional(v.string()),
      wompiData: v.optional(v.any()),
      boldData: v.optional(v.any()),
      receiptUrl: v.optional(v.string()),
      verifiedBy: v.optional(v.string()),
      verifiedAt: v.optional(v.number()),
      notes: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_booking', ['bookingId'])
      .index('by_transaction', ['transactionId'])
      .index('by_status', ['status']),

    googleCalendarIntegrations: defineTable({
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      expiresAt: v.optional(v.number()),
      calendarId: v.optional(v.string()),
      connected: v.boolean(),
      connectedEmail: v.optional(v.string()),
      connectedName: v.optional(v.string()),
      needsReauth: v.optional(v.boolean()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),

    /**
     * Config global del agente (singleton: key = 'default').
     * globalAiEnabled: conversaciones nuevas y elegibles entran en modo bot.
     */
    agentSettings: defineTable({
      key: v.string(),
      globalAiEnabled: v.boolean(),
      updatedAt: v.number(),
    }).index('by_key', ['key']),

    notificationSettings: defineTable({
      scope: v.literal('global'),
      payload: v.any(),
      updatedAt: v.number(),
    }).index('by_scope', ['scope']),

    whatsappTemporalMessage: defineTable({
      scope: v.literal('global'),
      enabled: v.boolean(),
      content: v.string(),
      validUntil: v.optional(v.number()),
      updatedAt: v.number(),
      updatedByUserId: v.optional(v.string()),
    }).index('by_scope', ['scope']),

    adminSessionLogs: defineTable({
      userId: v.string(),
      userEmail: v.string(),
      userName: v.optional(v.string()),
      role: v.optional(v.string()),
      loginAt: v.number(),
      logoutAt: v.optional(v.number()),
      ipAddress: v.optional(v.string()),
      userAgent: v.optional(v.string()),
    })
      .index('by_loginAt', ['loginAt'])
      .index('by_user_loginAt', ['userId', 'loginAt']),

    internalPages: defineTable({
      pageId: v.string(),
      content: v.any(),
      updatedAt: v.number(),
    }).index('by_pageId', ['pageId']),

    rolePermissions: defineTable({
      role: v.string(),
      module: v.string(),
      permissions: v.array(v.string()),
      isCustom: v.optional(v.boolean()),
      updatedAt: v.number(),
    })
      .index('by_role', ['role'])
      .index('by_role_module', ['role', 'module']),

    siteAnalytics: defineTable({
      metricKey: v.string(),
      count: v.number(),
      updatedAt: v.number(),
    }).index('by_metricKey', ['metricKey']),

    conversationOperationalStateEvents: defineTable({
      conversationId: v.id('conversations'),
      fromState: v.optional(
        v.union(
          v.literal('requires_advisor'),
          v.literal('validate_availability'),
          v.literal('ready_to_book'),
          v.literal('pending_payment'),
          v.literal('pending_data'),
        ),
      ),
      toState: v.union(
        v.literal('requires_advisor'),
        v.literal('validate_availability'),
        v.literal('ready_to_book'),
        v.literal('pending_payment'),
        v.literal('pending_data'),
      ),
      source: v.union(v.literal('bot'), v.literal('user')),
      userId: v.optional(v.string()),
      createdAt: v.number(),
    }).index('by_conversation', ['conversationId', 'createdAt']),

    contactNotes: defineTable({
      contactId: v.id('contacts'),
      content: v.string(),
      authorUserId: v.optional(v.string()),
      authorName: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    }).index('by_contact', ['contactId']),

    broadcastLogs: defineTable({
      templateKey: v.string(),
      templateName: v.string(),
      totalRequested: v.number(),
      totalSent: v.number(),
      totalFailed: v.number(),
      totalSkipped: v.number(),
      sentByUserId: v.optional(v.string()),
      bodyParams: v.optional(v.array(v.string())),
      recipients: v.array(
        v.object({
          contactId: v.id('contacts'),
          phone: v.string(),
          status: v.union(
            v.literal('sent'),
            v.literal('failed'),
            v.literal('skipped'),
          ),
          wamid: v.optional(v.string()),
          error: v.optional(v.string()),
        }),
      ),
      createdAt: v.number(),
    }).index('by_created', ['createdAt']),

    quienes_somos: defineTable({
      queEsFincasYa: v.string(),
      mision: v.string(),
      vision: v.string(),
      objetivos: v.union(v.string(), v.array(v.string())),
      politicas: v.union(v.string(), v.array(v.string())),
      trayectoriaTitle: v.string(),
      trayectoriaParagraphs: v.string(),
      stats: v.array(
        v.object({
          label: v.string(),
          value: v.string(),
        }),
      ),
      recognitionTitle: v.string(),
      recognitionSubtitle: v.string(),
      presenciaInstitucional: v.string(),
      carouselImages: v.optional(v.array(v.string())),
      videoUrl: v.optional(v.string()),
      videoTitle: v.optional(v.string()),
      videoDescription: v.optional(v.string()),
      videoBadge: v.optional(v.string()),
      updatedAt: v.number(),
    }),

    /** Solicitudes públicas de Habeas Data (Ley 1581) desde /habeas-data */
    habeas_data_requests: defineTable({
      fullName: v.string(),
      documentType: v.string(),
      documentNumber: v.string(),
      email: v.string(),
      phone: v.optional(v.string()),
      requestType: v.union(
        v.literal('acceso'),
        v.literal('rectificacion'),
        v.literal('cancelacion'),
        v.literal('oposicion'),
        v.literal('revocatoria'),
        v.literal('queja'),
      ),
      description: v.string(),
      status: v.union(
        v.literal('pending'),
        v.literal('in_progress'),
        v.literal('resolved'),
        v.literal('rejected'),
      ),
      submittedAt: v.number(),
      userAgent: v.optional(v.string()),
      ipAddress: v.optional(v.string()),
      resolvedAt: v.optional(v.number()),
      adminNotes: v.optional(v.string()),
    })
      .index('by_status', ['status'])
      .index('by_submittedAt', ['submittedAt'])
      .index('by_email', ['email']),

    /**
     * Canales sociales conectados via Meta (Facebook Pages / Instagram).
     * Una fila por Página de Facebook. `pageAccessToken` es SENSIBLE: nunca
     * exponer al cliente (solo se lee desde actions/webhook internos).
     * El token de Página, derivado de un user token de larga duracion, no
     * expira mientras la conexion siga vigente.
     */
    metaChannelConnections: defineTable({
      // Identidad de la Pagina de Facebook (fuente de verdad de la conexion).
      pageId: v.string(),
      pageName: v.string(),
      pageAccessToken: v.string(),
      category: v.optional(v.string()),
      pictureUrl: v.optional(v.string()),
      // Cuenta de Instagram Business vinculada a la Pagina (si existe).
      igUserId: v.optional(v.string()),
      igUsername: v.optional(v.string()),
      igPictureUrl: v.optional(v.string()),
      // Metadatos de la conexion.
      scopes: v.optional(v.array(v.string())),
      connected: v.boolean(),
      webhookSubscribed: v.optional(v.boolean()),
      connectedByUserId: v.optional(v.string()),
      connectedByName: v.optional(v.string()),
      tokenExpiresAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      /** Respuesta automática a comentarios nuevos vía webhook. */
      autoReplyComments: v.optional(v.boolean()),
      autoReplyMessage: v.optional(v.string()),
      autoReplyTemplateId: v.optional(v.string()),
      /** Plantillas de respuesta creadas por el operador (por página). */
      commentTemplates: v.optional(
        v.array(
          v.object({
            id: v.string(),
            label: v.string(),
            text: v.string(),
          }),
        ),
      ),
      /** Respuestas guardadas para mensajes directos (atajo + texto). */
      dmTemplates: v.optional(
        v.array(
          v.object({
            id: v.string(),
            shortcut: v.string(),
            text: v.string(),
          }),
        ),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index('by_page', ['pageId'])
      .index('by_ig', ['igUserId']),

    /** Respuestas enviadas a comentarios (manual o automática). */
    metaCommentReplies: defineTable({
      pageId: v.string(),
      provider: v.union(v.literal('facebook'), v.literal('instagram')),
      commentId: v.string(),
      replyText: v.string(),
      repliedAt: v.number(),
      auto: v.optional(v.boolean()),
    })
      .index('by_comment', ['provider', 'commentId'])
      .index('by_page', ['pageId']),

    /**
     * Log de eventos entrantes del webhook de Meta (comentarios, menciones,
     * mensajes). Alimenta el feed en tiempo real del panel de Canales y sirve
     * de auditoria. `payload` guarda el value crudo del cambio.
     */
    metaWebhookEvents: defineTable({
      provider: v.union(v.literal('facebook'), v.literal('instagram')),
      pageId: v.optional(v.string()),
      objectId: v.optional(v.string()),
      field: v.optional(v.string()),
      verb: v.optional(v.string()),
      commentId: v.optional(v.string()),
      parentId: v.optional(v.string()),
      fromId: v.optional(v.string()),
      fromName: v.optional(v.string()),
      text: v.optional(v.string()),
      permalink: v.optional(v.string()),
      handled: v.boolean(),
      payload: v.any(),
      receivedAt: v.number(),
    })
      .index('by_page', ['pageId'])
      .index('by_receivedAt', ['receivedAt'])
      .index('by_comment', ['commentId']),

    /** Hilos de Messenger e Instagram DM sincronizados desde Meta. */
    metaDmThreads: defineTable({
      pageId: v.string(),
      platform: v.union(v.literal('messenger'), v.literal('instagram')),
      metaConversationId: v.optional(v.string()),
      participantId: v.string(),
      participantName: v.optional(v.string()),
      participantPictureUrl: v.optional(v.string()),
      lastMessageText: v.optional(v.string()),
      lastMessageAt: v.number(),
      lastReadAt: v.optional(v.number()),
      updatedAt: v.number(),
    })
      .index('by_page_time', ['pageId', 'lastMessageAt'])
      .index('by_page_platform_participant', ['pageId', 'platform', 'participantId']),

    metaDmMessages: defineTable({
      threadId: v.id('metaDmThreads'),
      pageId: v.string(),
      metaMessageId: v.optional(v.string()),
      direction: v.union(v.literal('inbound'), v.literal('outbound')),
      text: v.optional(v.string()),
      attachmentType: v.optional(
        v.union(
          v.literal('image'),
          v.literal('audio'),
          v.literal('video'),
          v.literal('file'),
        ),
      ),
      attachmentUrl: v.optional(v.string()),
      fromId: v.optional(v.string()),
      fromName: v.optional(v.string()),
      createdAt: v.number(),
    })
      .index('by_thread', ['threadId', 'createdAt'])
      .index('by_meta_message', ['metaMessageId']),

    /** Oportunidades comerciales — embudo de ventas (CRM-3). */
    opportunities: defineTable({
      /** Contacto dueño de la oportunidad (puede ser undefined en deals sin lead vinculado). */
      contactId: v.optional(v.id('contacts')),
      /** Conversación de origen (si viene del bot/inbox). */
      conversationId: v.optional(v.id('conversations')),
      /** Link de venta vinculado (si el asesor creó uno). */
      saleLinkId: v.optional(v.id('saleLinks')),
      /** Reserva vinculada (cuando se ganó). */
      bookingId: v.optional(v.id('bookings')),

      /** Etapa del embudo comercial. */
      stage: v.union(
        v.literal('nuevo'),        // lead sin contexto de reserva
        v.literal('calificado'),   // bot detectó finca + fechas (dealLabel)
        v.literal('propuesta'),    // asesor creó link de venta
        v.literal('negociacion'),  // cliente subió comprobante (paso intermedio)
        v.literal('ganada'),       // pago validado
        v.literal('perdida'),      // cerrada manualmente como perdida
      ),

      /** Label del deal: "Quinta Montebello · 15pax · 07→10 ago" */
      dealLabel: v.optional(v.string()),
      /** Nombre de la finca (para mostrar en el kanban). */
      propertyName: v.optional(v.string()),
      /** Valor estimado o confirmado (COP). */
      estimatedValue: v.optional(v.number()),
      /** Check-in (timestamp ms). */
      checkIn: v.optional(v.number()),
      /** Check-out (timestamp ms). */
      checkOut: v.optional(v.number()),
      /** Número de huéspedes. */
      guests: v.optional(v.number()),

      /** Motivo de pérdida (libre). */
      lostReason: v.optional(v.string()),
      /** Asesor asignado (Convex user _id como string). */
      assignedUserId: v.optional(v.string()),
      /** Nombre del asesor asignado. */
      assignedUserName: v.optional(v.string()),
      /** Canal de origen. */
      source: v.optional(
        v.union(
          v.literal('bot'),
          v.literal('sale_link'),
          v.literal('manual'),
        ),
      ),

      createdAt: v.number(),
      updatedAt: v.optional(v.number()),
    })
      .index('by_contact', ['contactId'])
      .index('by_stage', ['stage'])
      .index('by_sale_link', ['saleLinkId'])
      .index('by_conversation', ['conversationId'])
      .index('by_created_at', ['createdAt']),
  },
  // Tablas importadas aun sin declarar (contracts, payments, reviews, ...)
  { strictTableNameTypes: false },
);
