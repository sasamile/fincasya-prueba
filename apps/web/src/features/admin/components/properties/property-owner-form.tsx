"use client";

import { useState, useEffect, useRef } from "react";
import {
  ArrowLeft,
  Save,
  Loader2,
  User,
  Phone,
  IdCard,
  Mail,
  Building2,
  CreditCard,
  FileCheck,
  CheckCircle2,
  Upload,
  X,
  Trash2,
  ExternalLink,
  Plus,
  MapPin,
  ImageIcon,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useProperty,
  usePropertyOwnerInfo,
  useUpdatePropertyOwnerInfo,
} from "@/features/fincas/queries/fincas.queries";
import type { OwnerBankAccount } from "@/features/fincas/types/fincas.types";
import {
  BANK_OTHER_VALUE,
  COLOMBIAN_BANKS,
  defaultAccountTypeForBank,
  getAccountTypesForBank,
  isCustomBankValue,
  normalizeAccountTypeForBank,
  resolveBankSelectValue,
} from "@/features/admin/constants/colombian-banks";
import { useRouter } from "next/navigation";
import { sileo } from "sileo";
import { cn } from "@/lib/utils";
import { propietarioTratoLabel } from "@/lib/owner-salutation";

interface PropertyOwnerFormProps {
  propertyId: string;
  isOwnerView?: boolean;
}

function createBankAccount(
  partial?: Partial<OwnerBankAccount>,
): OwnerBankAccount {
  return {
    id: partial?.id ?? crypto.randomUUID(),
    bankName: partial?.bankName ?? "",
    accountNumber: partial?.accountNumber ?? "",
    accountType: partial?.accountType
      ? normalizeAccountTypeForBank(
          partial.bankName ?? "",
          partial.accountType,
        )
      : defaultAccountTypeForBank(partial?.bankName ?? ""),
    accountHolderName: partial?.accountHolderName ?? "",
  };
}

function resolveInitialBankAccounts(
  ownerInfo?: {
    bankAccounts?: OwnerBankAccount[];
    bankName?: string;
    accountNumber?: string;
    propietarioNombre?: string;
  } | null,
): OwnerBankAccount[] {
  const fallbackHolder = ownerInfo?.propietarioNombre?.trim() ?? "";
  if (ownerInfo?.bankAccounts?.length) {
    return ownerInfo.bankAccounts.map((account) =>
      createBankAccount({
        ...account,
        accountHolderName:
          account.accountHolderName?.trim() || fallbackHolder || "",
      }),
    );
  }
  if (ownerInfo?.bankName || ownerInfo?.accountNumber) {
    return [
      createBankAccount({
        bankName: ownerInfo.bankName ?? "",
        accountNumber: ownerInfo.accountNumber ?? "",
        accountHolderName: fallbackHolder,
      }),
    ];
  }
  return [createBankAccount({ accountHolderName: fallbackHolder })];
}

export function PropertyOwnerForm({
  propertyId,
  isOwnerView = false,
}: PropertyOwnerFormProps) {
  const router = useRouter();
  const { data: property, isLoading: loadingProperty, isFetched: propertyFetched } =
    useProperty(propertyId);
  const {
    data: ownerInfo,
    isLoading: loadingOwnerInfo,
    isFetched: ownerFetched,
  } = usePropertyOwnerInfo(propertyId);
  const updateOwnerInfo = useUpdatePropertyOwnerInfo();

  const [formData, setFormData] = useState({
    propietarioNombre: "",
    propietarioTratamiento: "Sr",
    propietarioTelefono: "",
    propietarioCedula: "",
    propietarioCorreo: "",
    checkinUbicacionUrl: "",
    checkinWazeUrl: "",
    checkinIndicacionesLlegada: "",
    checkinRecomendaciones: "",
  });
  const [bankAccounts, setBankAccounts] = useState<OwnerBankAccount[]>([
    createBankAccount(),
  ]);

  const [files, setFiles] = useState<{
    bankCertification?: File;
    idCopy?: File;
    rntPdf?: File;
    chamberOfCommerce?: File;
  }>({});

  const [fileNames, setFileNames] = useState<{
    bankCertification?: string;
    idCopy?: string;
    rntPdf?: string;
    chamberOfCommerce?: string;
  }>({});

  const [removedExistingDocs, setRemovedExistingDocs] = useState<string[]>([]);

  // Galería de fotos/mapas de referencia (varias, reordenables).
  const MAX_LOCATION_IMAGES = 10;
  const [locationImages, setLocationImages] = useState<LocationImage[]>([]);
  const locationImagesRef = useRef<LocationImage[]>([]);
  locationImagesRef.current = locationImages;
  useEffect(() => {
    return () => {
      locationImagesRef.current.forEach((img) => {
        if (img.kind === "new") URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, []);

  const addLocationImages = (incoming: File[]) => {
    setLocationImages((prev) => {
      const room = MAX_LOCATION_IMAGES - prev.length;
      if (room <= 0) {
        sileo.error({
          title: `Máximo ${MAX_LOCATION_IMAGES} fotos`,
          fill: "#fee2e2",
        });
        return prev;
      }
      const accepted = incoming.slice(0, room);
      const next: LocationImage[] = accepted.map((file) => ({
        kind: "new",
        file,
        previewUrl: URL.createObjectURL(file),
        id: crypto.randomUUID(),
      }));
      return [...prev, ...next];
    });
  };

  const removeLocationImage = (index: number) => {
    setLocationImages((prev) => {
      const item = prev[index];
      if (item?.kind === "new") URL.revokeObjectURL(item.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const reorderLocationImages = (from: number, to: number) => {
    setLocationImages((prev) => {
      if (
        from === to ||
        from < 0 ||
        to < 0 ||
        from >= prev.length ||
        to >= prev.length
      ) {
        return prev;
      }
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (!propertyFetched || !ownerFetched) return;

    setFormData({
      propietarioNombre:
        (property as any)?.propietarioNombre ??
        ownerInfo?.propietarioNombre ??
        "",
      propietarioTratamiento:
        (property as any)?.propietarioTratamiento ??
        ownerInfo?.propietarioTratamiento ??
        "Sr",
      propietarioTelefono:
        (property as any)?.propietarioTelefono ??
        ownerInfo?.propietarioTelefono ??
        "",
      propietarioCedula:
        (property as any)?.propietarioCedula ??
        ownerInfo?.propietarioCedula ??
        "",
      propietarioCorreo:
        (property as any)?.propietarioCorreo ??
        ownerInfo?.propietarioCorreo ??
        "",
      checkinUbicacionUrl: ownerInfo?.checkinUbicacionUrl ?? "",
      checkinWazeUrl: ownerInfo?.checkinWazeUrl ?? "",
      checkinIndicacionesLlegada: ownerInfo?.checkinIndicacionesLlegada ?? "",
      checkinRecomendaciones: ownerInfo?.checkinRecomendaciones ?? "",
    });
    setBankAccounts(resolveInitialBankAccounts(ownerInfo));

    const initialUrls =
      ownerInfo?.checkinUbicacionImageUrls &&
      ownerInfo.checkinUbicacionImageUrls.length > 0
        ? ownerInfo.checkinUbicacionImageUrls
        : ownerInfo?.checkinUbicacionImageUrl
          ? [ownerInfo.checkinUbicacionImageUrl]
          : [];
    setLocationImages(
      initialUrls
        .filter((url) => typeof url === "string" && url.trim().length > 0)
        .map((url) => ({ kind: "existing", url })),
    );

    setInitialized(true);
  }, [property, ownerInfo, propertyFetched, ownerFetched, initialized]);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: keyof typeof files,
  ) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles((prev) => ({ ...prev, [field]: file }));
      setFileNames((prev) => ({ ...prev, [field]: file.name }));
    }
    if (removedExistingDocs.includes(field)) {
      setRemovedExistingDocs((prev) => prev.filter((d) => d !== field));
    }
  };

  const removeFile = (field: keyof typeof files) => {
    setFiles((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
    setFileNames((prev) => {
      const n = { ...prev };
      delete n[field];
      return n;
    });
  };

  const isSaving = updateOwnerInfo.isPending;

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!formData.propietarioNombre.trim()) {
      sileo.error({ title: "El nombre del propietario es obligatorio", fill: "#fee2e2" });
      return;
    }
    try {
      const cleanedBankAccounts = bankAccounts
        .map((account) => ({
          id: account.id,
          bankName: account.bankName.trim(),
          accountNumber: account.accountNumber.trim(),
          ...(account.accountType?.trim()
            ? { accountType: account.accountType.trim() }
            : {}),
          ...(account.accountHolderName?.trim()
            ? { accountHolderName: account.accountHolderName.trim() }
            : {}),
        }))
        .filter(
          (account) => account.bankName.length > 0 || account.accountNumber.length > 0,
        );

      const primaryBank = cleanedBankAccounts[0];

      // Galería de referencia: orden final (URLs a conservar + "__new__" por archivo nuevo).
      const checkinUbicacionImageOrder = locationImages.map((img) =>
        img.kind === "existing" ? img.url : "__new__",
      );
      const checkinUbicacionImages = locationImages
        .filter(
          (img): img is Extract<LocationImage, { kind: "new" }> =>
            img.kind === "new",
        )
        .map((img) => img.file);

      const ownerPayload: Record<
        string,
        string | string[] | OwnerBankAccount[]
      > = {
        ownerUserId: ownerInfo?.ownerUserId ?? "",
        rutNumber: ownerInfo?.rutNumber ?? "",
        bankName: primaryBank?.bankName ?? "",
        accountNumber: primaryBank?.accountNumber ?? "",
        bankAccounts: cleanedBankAccounts,
        rntNumber: ownerInfo?.rntNumber ?? "",
        propietarioNombre: formData.propietarioNombre.trim(),
        propietarioTratamiento: formData.propietarioTratamiento,
        propietarioTelefono: formData.propietarioTelefono.trim(),
        propietarioCedula: formData.propietarioCedula.trim(),
        propietarioCorreo: formData.propietarioCorreo.trim(),
        checkinUbicacionUrl: formData.checkinUbicacionUrl.trim(),
        checkinWazeUrl: formData.checkinWazeUrl.trim(),
        checkinIndicacionesLlegada: formData.checkinIndicacionesLlegada.trim(),
        checkinRecomendaciones: formData.checkinRecomendaciones.trim(),
        checkinUbicacionImageOrder,
      };
      if (removedExistingDocs.includes("bankCertification") && !files.bankCertification)
        ownerPayload.bankCertificationUrl = "";
      if (removedExistingDocs.includes("idCopy") && !files.idCopy)
        ownerPayload.idCopyUrl = "";
      if (removedExistingDocs.includes("rntPdf") && !files.rntPdf)
        ownerPayload.rntPdfUrl = "";
      if (removedExistingDocs.includes("chamberOfCommerce") && !files.chamberOfCommerce)
        ownerPayload.chamberOfCommerceUrl = "";

      const res = await updateOwnerInfo.mutateAsync({
        id: propertyId,
        payload: ownerPayload,
        files: { ...files, checkinUbicacionImages },
      });

      const waze = res as {
        wazeGenerada?: boolean;
        wazeFallida?: boolean;
        checkinWazeUrl?: string;
      };
      if (waze?.wazeGenerada && waze.checkinWazeUrl) {
        const url = waze.checkinWazeUrl;
        setFormData((prev) => ({ ...prev, checkinWazeUrl: url }));
        sileo.success({
          title: "Guardado · enlace de Waze generado desde Google Maps",
          fill: "#f0fdf4",
        });
      } else if (waze?.wazeFallida) {
        sileo.success({
          title: "Información del propietario guardada",
          fill: "#f0fdf4",
        });
        sileo.error({
          title:
            "No se pudo generar el Waze automáticamente. Si lo necesitas, pégalo a mano.",
          fill: "#fef9c3",
        });
      } else {
        sileo.success({
          title: "Información del propietario guardada",
          fill: "#f0fdf4",
        });
      }
    } catch (error: unknown) {
      const message =
        (error as { response?: { data?: { message?: string | string[] } } })
          ?.response?.data?.message ??
        (error instanceof Error ? error.message : null);
      const detail = Array.isArray(message)
        ? message.join(", ")
        : typeof message === "string"
          ? message
          : "Error al guardar los datos";
      sileo.error({ title: detail, fill: "#fee2e2" });
    }
  };

  const inputClass =
    "w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm pl-11";
  const selectTriggerClass =
    "w-full h-12 bg-background border border-border rounded-2xl px-4 text-sm text-foreground focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm pl-11";
  const labelClass =
    "block text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1";

  const isLoading =
    !propertyFetched || !ownerFetched || loadingProperty || loadingOwnerInfo;

  if (isLoading) {
    return <PropertyOwnerFormSkeleton />;
  }

  const contactFields: {
    key: keyof typeof formData;
    label: string;
    placeholder: string;
    required?: boolean;
    icon: React.ReactNode;
    type?: string;
  }[] = [
    {
      key: "propietarioNombre",
      label: "Nombre del propietario *",
      placeholder: "Ej: Carlos Ramírez",
      required: true,
      icon: (
        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
      ),
    },
    {
      key: "propietarioTelefono",
      label: "Teléfono / WhatsApp",
      placeholder: "Ej: +57 300 123 4567",
      icon: (
        <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
      ),
      type: "tel",
    },
    {
      key: "propietarioCedula",
      label: "Cédula / NIT",
      placeholder: "Ej: 1.012.345.678",
      icon: (
        <IdCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
      ),
    },
    {
      key: "propietarioCorreo",
      label: "Correo electrónico",
      placeholder: "Ej: propietario@email.com",
      icon: (
        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
      ),
      type: "email",
    },
  ];

  return (
    <form
      onSubmit={handleSubmit}
      className="p-0 md:p-8 lg:p-10 bg-transparent min-h-[calc(100vh-4rem)] relative pb-24"
    >
      <div className="space-y-8 max-w-4xl mx-auto relative z-10">
        {/* Header */}
        {!isOwnerView && (
          <div className="flex items-center justify-between top-[56px] md:top-[64px] z-20 backdrop-blur-2xl py-4 md:py-5 -mx-4 md:-mx-6 px-4 md:px-6 mb-6 md:mb-10 transition-colors duration-500 border-b border-border/50">
            <div className="flex items-center gap-3 md:gap-6 w-full">
              <button
                type="button"
                onClick={() => router.back()}
                className="p-3 md:p-4 rounded-xl md:rounded-[20px] border border-border bg-background hover:bg-muted/50 shadow-sm transition-colors active:scale-95 group shrink-0"
              >
                <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg md:text-3xl font-bold tracking-tight leading-none bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-transparent truncate">
                  Información del Propietario
                </h1>
                <div className="flex items-center gap-2 mt-1 md:mt-2">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                    <div className="w-1 h-1 rounded-full bg-violet-500 animate-pulse" />
                    <span className="text-[8px] md:text-[10px] font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-widest leading-none">
                      {property?.code || "Propiedad"}
                    </span>
                  </div>
                  <p className="text-[9px] md:text-[11px] font-semibold text-muted-foreground uppercase tracking-widest truncate">
                    {property?.title}
                  </p>
                </div>
              </div>
            </div>
            <Button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 h-12 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 w-full sm:w-auto"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Guardar
            </Button>
          </div>
        )}

        {/* Datos de contacto */}
        <section className="rounded-[40px] bg-background border border-border shadow-sm overflow-hidden hover:shadow-xl hover:shadow-violet-500/5 transition-all duration-500">
          <div className="flex items-center gap-4 px-6 md:px-8 py-5 md:py-7 border-b border-border/50 bg-linear-to-br from-violet-500/10 to-transparent">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-violet-500 text-white flex items-center justify-center shadow-lg shadow-violet-500/20">
              <User className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg md:text-xl text-foreground tracking-tight">
                Datos del propietario
              </h2>
              <p className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 uppercase tracking-widest mt-0.5">
                Contacto y documentación básica
              </p>
            </div>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            <div className="space-y-1.5">
              <label className={labelClass}>Tratamiento (para el saludo)</label>
              <div className="flex gap-3 px-1">
                {(
                  [
                    { value: "Sr", label: "Señor" },
                    { value: "Sra", label: "Señora" },
                  ] as const
                ).map((opt) => {
                  const active = formData.propietarioTratamiento === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          propietarioTratamiento: opt.value,
                        }))
                      }
                      className={cn(
                        "flex-1 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all",
                        active
                          ? "border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300"
                          : "border-border bg-background text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="px-1 text-[11px] text-muted-foreground">
                Se usa en los mensajes: “Hola, {propietarioTratoLabel(formData.propietarioTratamiento)}{" "}
                {formData.propietarioNombre.trim() || "Nombre Apellido"}”.
              </p>
            </div>

            {contactFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <label className={labelClass}>{field.label}</label>
                <div className="relative group">
                  {field.icon}
                  <input
                    type={field.type ?? "text"}
                    name={field.key}
                    required={field.required}
                    placeholder={field.placeholder}
                    value={formData[field.key]}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            ))}

            <div className="space-y-5 rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
              <div>
                <label className={labelClass}>
                  Link de Google Maps
                </label>
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Pega el enlace de Google Maps de la ubicación exacta de la
                  finca.{" "}
                  <strong className="font-semibold text-violet-700">
                    Solo se envía al cliente con el check-in
                  </strong>{" "}
                  — no se usa en el catálogo ni en mapas públicos.
                </p>
                <div className="relative group mt-2">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
                  <input
                    type="url"
                    name="checkinUbicacionUrl"
                    placeholder="Ej: https://maps.app.goo.gl/... o https://www.google.com/maps/..."
                    value={formData.checkinUbicacionUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        checkinUbicacionUrl: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                {formData.checkinUbicacionUrl.trim().startsWith("http") ? (
                  <a
                    href={formData.checkinUbicacionUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-1 mt-2 text-[11px] font-semibold text-violet-600 hover:text-violet-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Probar enlace Google Maps
                  </a>
                ) : null}
              </div>

              <div>
                <label className={labelClass}>
                  Link de Waze
                </label>
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Pega el enlace de Waze para que el cliente pueda navegar con
                  esa app. También es exclusivo del check-in.
                </p>
                <div className="relative group mt-2">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-violet-500 transition-colors" />
                  <input
                    type="url"
                    name="checkinWazeUrl"
                    placeholder="Ej: https://waze.com/ul/... o https://www.waze.com/live-map/..."
                    value={formData.checkinWazeUrl}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        checkinWazeUrl: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </div>
                {formData.checkinWazeUrl.trim().startsWith("http") ? (
                  <a
                    href={formData.checkinWazeUrl.trim()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-1 mt-2 text-[11px] font-semibold text-violet-600 hover:text-violet-800"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Probar enlace Waze
                  </a>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Indicaciones de llegada</label>
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Describe cómo llegar: colores de la casa, portón, referencias
                  visibles, instrucciones del guarda, etc.
                </p>
                <textarea
                  name="checkinIndicacionesLlegada"
                  rows={4}
                  placeholder="Ej: Casa blanca con portón negro a mano derecha. Tocar timbre y mencionar reserva FincasYa..."
                  value={formData.checkinIndicacionesLlegada}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      checkinIndicacionesLlegada: e.target.value,
                    }))
                  }
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm resize-y min-h-[100px]"
                />
              </div>

              <div className="space-y-1.5">
                <label className={labelClass}>Recomendaciones de la finca</label>
                <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                  Normas, cuidados y tips específicos de esta casa (piscina,
                  mascotas, ruido, basuras, etc.).{" "}
                  <strong className="font-semibold text-violet-700">
                    Se muestran al turista en el portal de check-in
                  </strong>{" "}
                  y se pueden incluir al compartir el link.
                </p>
                <textarea
                  name="checkinRecomendaciones"
                  rows={6}
                  placeholder="Ej: No ingresar mascotas a la piscina. Apagar luces exteriores a las 10 pm. Separar basuras en bolsas azules..."
                  value={formData.checkinRecomendaciones}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      checkinRecomendaciones: e.target.value,
                    }))
                  }
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all duration-200 shadow-sm resize-y min-h-[120px]"
                />
              </div>

              <LocationImagesUploadField
                label="Foto o mapa de referencia"
                images={locationImages}
                max={MAX_LOCATION_IMAGES}
                onAddFiles={addLocationImages}
                onRemove={removeLocationImage}
                onReorder={reorderLocationImages}
                labelClass={labelClass}
              />
            </div>
          </div>
        </section>

        {/* Información bancaria */}
        <section className="rounded-[40px] bg-background border border-border shadow-sm overflow-hidden hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-500">
          <div className="flex items-center justify-between gap-4 px-6 md:px-8 py-5 md:py-7 border-b border-border/50 bg-linear-to-br from-emerald-500/10 to-transparent">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Building2 className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <div>
                <h2 className="font-bold text-lg md:text-xl text-foreground tracking-tight">
                  Información bancaria del propietario
                </h2>
                <p className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-widest mt-0.5">
                  Pagos y transferencias
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setBankAccounts((prev) => [
                  ...prev,
                  createBankAccount({
                    accountHolderName: formData.propietarioNombre.trim(),
                  }),
                ])
              }
              className="h-9 px-3 rounded-xl font-semibold text-[11px] shrink-0"
            >
              <Plus className="w-3.5 h-3.5 mr-1.5" />
              Agregar cuenta
            </Button>
          </div>
          <div className="p-6 md:p-8 space-y-6">
            {bankAccounts.map((account, index) => (
              <div
                key={account.id}
                className="rounded-[28px] border border-border/70 bg-muted/10 p-5 md:p-6 space-y-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    Cuenta {index + 1}
                  </p>
                  {bankAccounts.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setBankAccounts((prev) =>
                          prev.filter((item) => item.id !== account.id),
                        )
                      }
                      className="h-8 px-3 rounded-xl text-[10px] font-bold uppercase text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                      Quitar
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className={labelClass}>Titular de la cuenta</label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                    <input
                      placeholder="Nombre de quien recibe la consignación"
                      value={account.accountHolderName ?? ""}
                      onChange={(e) =>
                        setBankAccounts((prev) =>
                          prev.map((item) =>
                            item.id === account.id
                              ? { ...item, accountHolderName: e.target.value }
                              : item,
                          ),
                        )
                      }
                      className={inputClass}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground pl-1">
                    Puede ser otra persona distinta al propietario de la finca.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:col-span-2">
                  <div className="space-y-1.5">
                    <label className={labelClass}>Banco</label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors z-10 pointer-events-none" />
                      <Select
                        value={resolveBankSelectValue(account.bankName)}
                        onValueChange={(value) =>
                          setBankAccounts((prev) =>
                            prev.map((item) => {
                              if (item.id !== account.id) return item;
                              const bankName = isCustomBankValue(value)
                                ? item.bankName &&
                                  !COLOMBIAN_BANKS.some(
                                    (bank) =>
                                      bank.toLowerCase() ===
                                      item.bankName.toLowerCase(),
                                  )
                                  ? item.bankName
                                  : ""
                                : value;
                              return {
                                ...item,
                                bankName,
                                accountType: normalizeAccountTypeForBank(
                                  bankName,
                                  item.accountType,
                                ),
                              };
                            }),
                          )
                        }
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue placeholder="Seleccionar banco..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl max-h-[280px]">
                          {COLOMBIAN_BANKS.map((bank) => (
                            <SelectItem key={bank} value={bank} className="rounded-xl">
                              {bank}
                            </SelectItem>
                          ))}
                          <SelectItem value={BANK_OTHER_VALUE} className="rounded-xl">
                            Otro
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {isCustomBankValue(resolveBankSelectValue(account.bankName)) ? (
                      <input
                        placeholder="Escriba el nombre del banco"
                        value={account.bankName}
                        onChange={(e) => {
                          const bankName = e.target.value;
                          setBankAccounts((prev) =>
                            prev.map((item) =>
                              item.id === account.id
                                ? {
                                    ...item,
                                    bankName,
                                    accountType: normalizeAccountTypeForBank(
                                      bankName,
                                      item.accountType,
                                    ),
                                  }
                                : item,
                            ),
                          );
                        }}
                        className={`${inputClass} mt-2 pl-4`}
                      />
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelClass}>Tipo de cuenta</label>
                    <div className="relative group">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors z-10 pointer-events-none" />
                      <Select
                        value={normalizeAccountTypeForBank(
                          account.bankName,
                          account.accountType,
                        )}
                        onValueChange={(value) =>
                          setBankAccounts((prev) =>
                            prev.map((item) =>
                              item.id === account.id
                                ? { ...item, accountType: value }
                                : item,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className={selectTriggerClass}>
                          <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {getAccountTypesForBank(account.bankName).map(
                            (type) => (
                              <SelectItem
                                key={type}
                                value={type}
                                className="rounded-xl"
                              >
                                {type}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className={labelClass}>Número de cuenta</label>
                    <div className="relative group">
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-emerald-500 transition-colors" />
                      <input
                        placeholder="Ej: 1234567890"
                        value={account.accountNumber}
                        onChange={(e) =>
                          setBankAccounts((prev) =>
                            prev.map((item) =>
                              item.id === account.id
                                ? { ...item, accountNumber: e.target.value }
                                : item,
                            ),
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Documentación PDF */}
        <section className="rounded-[40px] bg-background border border-border shadow-sm overflow-hidden hover:shadow-xl hover:shadow-orange-500/5 transition-all duration-500">
          <div className="flex items-center gap-4 px-6 md:px-8 py-5 md:py-7 border-b border-border/50 bg-linear-to-br from-orange-500/10 to-transparent">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl bg-orange-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
              <FileCheck className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg md:text-xl text-foreground tracking-tight">
                Documentación PDF
              </h2>
              <p className="text-[10px] font-semibold text-orange-500 dark:text-orange-400 uppercase tracking-widest mt-0.5">
                Soporte legal obligatorios
              </p>
            </div>
          </div>
          <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <FileUploadField
              label="Certificación Bancaria"
              fieldName="bankCertification"
              currentUrl={
                !removedExistingDocs.includes("bankCertification")
                  ? ownerInfo?.bankCertificationUrl
                  : undefined
              }
              fileName={fileNames.bankCertification}
              onChange={(e) => handleFileChange(e, "bankCertification")}
              onRemove={() => removeFile("bankCertification")}
              onRemoveExisting={() =>
                setRemovedExistingDocs((prev) => [...prev, "bankCertification"])
              }
              labelClass={labelClass}
            />
            <FileUploadField
              label="Fotocopia de la Cédula"
              fieldName="idCopy"
              currentUrl={
                !removedExistingDocs.includes("idCopy")
                  ? ownerInfo?.idCopyUrl
                  : undefined
              }
              fileName={fileNames.idCopy}
              onChange={(e) => handleFileChange(e, "idCopy")}
              onRemove={() => removeFile("idCopy")}
              onRemoveExisting={() =>
                setRemovedExistingDocs((prev) => [...prev, "idCopy"])
              }
              labelClass={labelClass}
            />
            <FileUploadField
              label="PDF RNT"
              fieldName="rntPdf"
              currentUrl={
                !removedExistingDocs.includes("rntPdf")
                  ? ownerInfo?.rntPdfUrl
                  : undefined
              }
              fileName={fileNames.rntPdf}
              onChange={(e) => handleFileChange(e, "rntPdf")}
              onRemove={() => removeFile("rntPdf")}
              onRemoveExisting={() =>
                setRemovedExistingDocs((prev) => [...prev, "rntPdf"])
              }
              labelClass={labelClass}
            />
            <FileUploadField
              label="Cámara de Comercio"
              fieldName="chamberOfCommerce"
              currentUrl={
                !removedExistingDocs.includes("chamberOfCommerce")
                  ? ownerInfo?.chamberOfCommerceUrl
                  : undefined
              }
              fileName={fileNames.chamberOfCommerce}
              onChange={(e) => handleFileChange(e, "chamberOfCommerce")}
              onRemove={() => removeFile("chamberOfCommerce")}
              onRemoveExisting={() =>
                setRemovedExistingDocs((prev) => [...prev, "chamberOfCommerce"])
              }
              labelClass={labelClass}
            />
          </div>
        </section>

        {/* Sticky save for owner view */}
        {isOwnerView && (
          <div className="sticky bottom-6 mt-12 z-50 px-6 py-4 bg-background/60 backdrop-blur-2xl border border-border/40 rounded-[32px] shadow-2xl shadow-primary/20 animate-in slide-in-from-bottom duration-500 max-w-4xl mx-auto">
            <button
              type="submit"
              disabled={isSaving}
              className="w-full inline-flex items-center justify-center gap-4 px-8 py-3.5 rounded-2xl bg-linear-to-r from-primary via-primary/90 to-primary/80 text-white text-sm font-bold shadow-2xl shadow-primary/30 transition-all duration-500 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-1 active:scale-[0.98] group overflow-hidden relative"
            >
              {isSaving ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <>
                  <div className="p-2 rounded-xl bg-white/20 group-hover:scale-125 transition-transform duration-500">
                    <Save className="w-5 h-5" />
                  </div>
                  <span className="tracking-widest uppercase text-[11px]">
                    Guardar Cambios
                  </span>
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

function PropertyOwnerFormSkeleton() {
  return (
    <div className="max-w-4xl mx-auto pb-20 px-4 mt-10">
      <div className="flex items-center justify-between mb-10 pb-5 border-b border-border">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-[20px] bg-muted" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64 rounded-lg bg-muted" />
            <Skeleton className="h-4 w-40 rounded-full bg-muted" />
          </div>
        </div>
        <Skeleton className="h-12 w-32 rounded-2xl bg-muted" />
      </div>
      <div className="space-y-8">
        <Skeleton className="h-80 w-full rounded-[40px] bg-muted/50" />
        <Skeleton className="h-48 w-full rounded-[40px] bg-muted/50" />
        <Skeleton className="h-96 w-full rounded-[40px] bg-muted/50" />
      </div>
    </div>
  );
}

interface FileUploadFieldProps {
  label: string;
  fieldName: string;
  currentUrl?: string;
  fileName?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
  onRemoveExisting: () => void;
  labelClass: string;
}

function FileUploadField({
  label,
  fieldName,
  currentUrl,
  fileName,
  onChange,
  onRemove,
  onRemoveExisting,
  labelClass,
}: FileUploadFieldProps) {
  return (
    <div className="space-y-2">
      <label className={labelClass}>{label}</label>
      <div className="relative group overflow-hidden">
        <input
          type="file"
          id={fieldName}
          accept="application/pdf"
          className="hidden"
          onChange={onChange}
        />
        <div
          className={cn(
            "relative flex flex-col items-center justify-center border border-border rounded-[30px] p-6 transition-all duration-300 h-44 text-center",
            fileName || currentUrl
              ? "bg-orange-500/5 border-orange-500/20"
              : "bg-muted/30 hover:bg-muted/50 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
          )}
        >
          {fileName ? (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
              <div className="p-3 rounded-2xl bg-orange-600 text-white mb-3 shadow-lg shadow-orange-500/20">
                <FileCheck className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-foreground truncate max-w-[180px]">
                {fileName}
              </span>
              <span className="text-[10px] text-orange-500 dark:text-orange-400 mt-1 uppercase font-bold tracking-tight">
                Listo para enviar
              </span>
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
                className="absolute top-4 right-4 w-9 h-9 rounded-xl shadow-xl active:scale-95"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : currentUrl ? (
            <div className="flex flex-col items-center animate-in fade-in">
              <div className="p-3 rounded-2xl bg-emerald-500 text-white mb-3 shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="text-sm font-bold text-foreground leading-tight">
                Documento Guardado
              </span>
              <div className="flex items-center gap-2 mt-4">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase border-border bg-background hover:bg-muted"
                >
                  <a href={currentUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Ver
                  </a>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onRemoveExisting();
                  }}
                  className="h-9 px-4 rounded-xl text-[10px] font-bold uppercase text-red-500 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Quitar
                </Button>
              </div>
              <label
                htmlFor={fieldName}
                className="absolute bottom-3 right-3 p-2 rounded-xl hover:bg-orange-500/10 cursor-pointer text-orange-600 dark:text-orange-400 transition-colors"
                title="Cambiar archivo"
              >
                <Upload className="w-4 h-4" />
              </label>
            </div>
          ) : (
            <label
              htmlFor={fieldName}
              className="w-full h-full flex flex-col items-center justify-center cursor-pointer group-hover:scale-105 transition-transform"
            >
              <div className="p-4 rounded-2xl bg-background border border-border text-muted-foreground group-hover:text-orange-500 group-hover:border-orange-500/30 transition-all duration-300 shadow-sm">
                <Upload className="w-7 h-7" />
              </div>
              <span className="text-sm font-bold text-foreground mt-4 group-hover:text-orange-500 dark:group-hover:text-orange-400 transition-colors">
                Subir Soporte PDF
              </span>
              <span className="text-[10px] text-muted-foreground mt-1 uppercase font-bold tracking-widest">
                Máximo 50MB
              </span>
            </label>
          )}
        </div>
      </div>
    </div>
  );
}

type LocationImage =
  | { kind: "existing"; url: string }
  | { kind: "new"; file: File; previewUrl: string; id: string };

function locationImagePreview(img: LocationImage): string {
  return img.kind === "existing" ? img.url : img.previewUrl;
}

interface LocationImagesUploadFieldProps {
  label: string;
  images: LocationImage[];
  max: number;
  onAddFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  labelClass: string;
}

function LocationImagesUploadField({
  label,
  images,
  max,
  onAddFiles,
  onRemove,
  onReorder,
  labelClass,
}: LocationImagesUploadFieldProps) {
  const inputId = "checkinUbicacionImages";
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const canAddMore = images.length < max;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length) onAddFiles(selected);
    // Permite volver a elegir el mismo archivo.
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <label className={cn(labelClass, "mb-0")}>{label}</label>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {images.length} / {max}
        </span>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
        Sube una o varias fotos (mapa, fachada, portón, referencias) para que el
        huésped llegue sin confusiones.{" "}
        <strong className="font-semibold text-violet-700">
          Arrastra las miniaturas
        </strong>{" "}
        para cambiar el orden en que las verá.
      </p>

      <input
        type="file"
        id={inputId}
        accept="image/jpeg,image/png,image/webp,image/heic,image/gif"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((img, index) => {
            const key = img.kind === "new" ? img.id : `existing-${img.url}`;
            const isDragging = dragIndex === index;
            const isOver = overIndex === index && dragIndex !== index;
            return (
              <div
                key={key}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnter={() => setOverIndex(index)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== index) {
                    onReorder(dragIndex, index);
                  }
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={cn(
                  "group relative flex flex-col overflow-hidden rounded-2xl border bg-violet-500/5 transition-all duration-200",
                  isDragging
                    ? "border-violet-500 opacity-50"
                    : "border-violet-500/20",
                  isOver && "border-violet-500 ring-2 ring-violet-400/40",
                )}
              >
                <div className="absolute left-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-black/55 px-2 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
                  <GripVertical className="h-3 w-3" />
                  {index + 1}
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-red-500"
                  aria-label="Quitar imagen"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={locationImagePreview(img)}
                  alt={`Referencia de llegada ${index + 1}`}
                  className="h-32 w-full cursor-grab object-cover active:cursor-grabbing"
                  draggable={false}
                />
                <span className="truncate px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                  {img.kind === "new" ? "Nueva · sin guardar" : "Guardada"}
                </span>
              </div>
            );
          })}

          {canAddMore ? (
            <label
              htmlFor={inputId}
              className="flex h-full min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 p-4 text-center transition-all hover:border-violet-500/40 hover:bg-muted/50"
            >
              <div className="rounded-2xl bg-background p-3 text-muted-foreground shadow-sm">
                <Plus className="h-5 w-5" />
              </div>
              <span className="text-[11px] font-bold text-foreground">
                Agregar foto
              </span>
            </label>
          ) : null}
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="group flex min-h-[180px] w-full cursor-pointer flex-col items-center justify-center rounded-[30px] border border-border bg-muted/30 p-4 text-center transition-all duration-300 hover:border-primary/30 hover:bg-muted/50"
        >
          <div className="rounded-2xl border border-border bg-background p-4 text-muted-foreground shadow-sm transition-all group-hover:border-violet-500/30 group-hover:text-violet-500">
            <ImageIcon className="h-7 w-7" />
          </div>
          <span className="mt-4 text-sm font-bold text-foreground transition-colors group-hover:text-violet-600">
            Subir fotos o mapa
          </span>
          <span className="mt-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            JPG, PNG o WEBP · máx. 50MB c/u · hasta {max}
          </span>
        </label>
      )}
    </div>
  );
}
