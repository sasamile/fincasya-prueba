"use client";

import { use } from "react";
import { PropertyEditForm } from "@/features/admin/components/properties/property-edit-form";

interface EditPropertyPageProps {
  params: Promise<{ id: string }>;
}

export default function EditPropertyPage({ params }: EditPropertyPageProps) {
  const { id } = use(params);
  return (
    <div className="p-0">
      <PropertyEditForm propertyId={id} />
    </div>
  );
}
