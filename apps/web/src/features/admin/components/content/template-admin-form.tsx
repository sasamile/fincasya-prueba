"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContractAdminData } from "@/features/admin/utils/contract-utils";
import { FormSection } from "@/features/admin/components/shared/form-section";
import { Banknote } from "lucide-react";

interface TemplateAdminFormProps {
  data: ContractAdminData;
  onChange: (data: ContractAdminData) => void;
}

export function TemplateAdminForm({ data, onChange }: TemplateAdminFormProps) {

  const handleChange = (field: keyof ContractAdminData, value: string) => {
    onChange({ ...data, [field]: value });
  };

  const labelClass = "text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block";
  const inputClass = "bg-background/50 border-border rounded-xl focus:ring-primary/20";

  return (
    <div className="space-y-6">
      <FormSection
        title="Costos y Multas de la Finca"
        description="Valores específicos para esta propiedad"
        icon={Banknote}
        gradientFrom="from-amber-500/5"
        iconBg="bg-amber-600"
        iconShadow="shadow-amber-600/20"
        textColor="text-amber-600"
        hoverShadow="hover:shadow-amber-500/5"
        defaultOpen={true}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className={labelClass}>Aseo Final</Label>
            <Input
              value={data.precioAseoFinal}
              onChange={(e) => handleChange("precioAseoFinal", e.target.value)}
              className={inputClass}
              placeholder="Ej: $100.000"
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>Persona Extra / Noche</Label>
            <Input
              value={data.precioPorPersonasExtras}
              onChange={(e) => handleChange("precioPorPersonasExtras", e.target.value)}
              className={inputClass}
              placeholder="Ej: $50.000"
            />
          </div>
          <div className="space-y-1">
            <Label className={labelClass}>Depósito Mascota</Label>
            <Input
              value={data.precioPorMasota}
              onChange={(e) => handleChange("precioPorMasota", e.target.value)}
              className={inputClass}
              placeholder="Ej: $200.000"
            />
          </div>
        </div>
      </FormSection>

    </div>
  );
}
