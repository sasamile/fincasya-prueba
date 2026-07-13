"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Tipos de solicitud que un titular de datos puede ejercer bajo la Ley 1581
 * Colombia (derechos ARCO + revocatoria).
 */
const REQUEST_TYPES = [
  {
    value: "acceso",
    label: "Acceso",
    description: "Quiero saber qué datos míos tienen.",
  },
  {
    value: "rectificacion",
    label: "Rectificación",
    description: "Quiero corregir o actualizar mis datos.",
  },
  {
    value: "cancelacion",
    label: "Cancelación / Supresión",
    description: "Quiero que eliminen mis datos.",
  },
  {
    value: "oposicion",
    label: "Oposición",
    description: "No quiero que usen mis datos para X finalidad.",
  },
  {
    value: "revocatoria",
    label: "Revocatoria del consentimiento",
    description: "Quiero retirar la autorización previa.",
  },
  {
    value: "queja",
    label: "Queja por uso indebido",
    description: "Considero que mis datos fueron tratados indebidamente.",
  },
] as const;

type RequestType = (typeof REQUEST_TYPES)[number]["value"];

type Status = "idle" | "submitting" | "success" | "error";

export function HabeasDataForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [documentType, setDocumentType] = useState("CC");
  const [documentNumber, setDocumentNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requestType, setRequestType] = useState<RequestType | "">("");
  const [description, setDescription] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  function reset() {
    setFullName("");
    setDocumentType("CC");
    setDocumentNumber("");
    setEmail("");
    setPhone("");
    setRequestType("");
    setDescription("");
    setAcceptTerms(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!requestType) {
      setErrorMsg("Selecciona el tipo de solicitud.");
      return;
    }
    if (!acceptTerms) {
      setErrorMsg(
        "Debes autorizar el tratamiento de tus datos para gestionar esta solicitud.",
      );
      return;
    }

    setStatus("submitting");
    try {
      const res = await fetch("/api/habeas-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          documentType,
          documentNumber: documentNumber.trim(),
          email: email.trim(),
          phone: phone.trim(),
          requestType,
          description: description.trim(),
          submittedAt: new Date().toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error ??
            "No pudimos enviar tu solicitud. Intenta de nuevo.",
        );
      }

      setStatus("success");
      reset();
    } catch (err) {
      setStatus("error");
      setErrorMsg(
        err instanceof Error
          ? err.message
          : "Ocurrió un error inesperado. Intenta de nuevo.",
      );
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
        <h3 className="mt-3 text-lg font-bold text-emerald-900">
          Solicitud recibida
        </h3>
        <p className="mt-2 text-sm text-emerald-800">
          Tienes 15 días hábiles para recibir respuesta según la Ley 1581. Te
          contactaremos a {email || "tu correo registrado"}.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => setStatus("idle")}
        >
          Enviar otra solicitud
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Tus datos serán usados <strong>únicamente</strong> para gestionar
            esta solicitud. Te responderemos en máximo{" "}
            <strong>15 días hábiles</strong> (consultas) o{" "}
            <strong>15 días hábiles prorrogables a 8 más</strong> (reclamos),
            como lo establece la Ley 1581 de 2012.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <Label htmlFor="fullName">Nombre completo *</Label>
          <Input
            id="fullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Como aparece en tu documento"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="documentType">Tipo de documento *</Label>
          <Select value={documentType} onValueChange={setDocumentType}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CC">Cédula de ciudadanía</SelectItem>
              <SelectItem value="CE">Cédula de extranjería</SelectItem>
              <SelectItem value="PA">Pasaporte</SelectItem>
              <SelectItem value="NIT">NIT (empresa)</SelectItem>
              <SelectItem value="OTRO">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="documentNumber">Número de documento *</Label>
          <Input
            id="documentNumber"
            required
            value={documentNumber}
            onChange={(e) => setDocumentNumber(e.target.value)}
            placeholder="1234567890"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="email">Correo electrónico *</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phone">Teléfono (opcional)</Label>
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+57 300 000 0000"
            className="mt-1"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="requestType">Tipo de solicitud *</Label>
          <Select
            value={requestType}
            onValueChange={(v) => setRequestType(v as RequestType)}
          >
            <SelectTrigger id="requestType" className="mt-1">
              <SelectValue placeholder="Selecciona qué derecho deseas ejercer" />
            </SelectTrigger>
            <SelectContent>
              {REQUEST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {requestType && (
            <p className="mt-1 text-xs text-muted-foreground">
              {REQUEST_TYPES.find((t) => t.value === requestType)?.description}
            </p>
          )}
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="description">Descripción de la solicitud *</Label>
          <Textarea
            id="description"
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Explica con detalle qué necesitas. Si pides rectificación, indica el dato actual y el corregido."
            className="mt-1"
          />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <label className="flex cursor-pointer items-start gap-3 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-1 h-4 w-4 shrink-0 rounded border-border accent-primary"
          />
          <span>
            Autorizo a FincasYa para tratar los datos personales suministrados
            en este formulario, con la única finalidad de tramitar y dar
            respuesta a mi solicitud, conforme a la{" "}
            <a
              href="/politica-de-privacidad"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Política de Tratamiento de Datos Personales
            </a>{" "}
            y la Ley 1581 de 2012.
          </span>
        </label>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <Button
        type="submit"
        disabled={status === "submitting"}
        className="h-11 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 md:w-auto md:px-8"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Enviando...
          </>
        ) : (
          "Enviar solicitud"
        )}
      </Button>
    </form>
  );
}
