"use client";

import { use } from "react";
import { PropertyOwnerForm } from "@/features/admin/components/properties/property-owner-form";

interface PropertyOwnerPageProps {
  params: Promise<{ id: string }>;
}

export default function PropertyOwnerPage({ params }: PropertyOwnerPageProps) {
  const { id } = use(params);
  
  return (
    <div className="p-0">
      <PropertyOwnerForm propertyId={id} />
    </div>
  );
}
