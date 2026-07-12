"use client";

import { useState, useEffect } from "react";
import { Shield, Save, Loader2, Users, Building2, Calendar, CreditCard, MessageSquare, Star, FileText, BookOpen, BarChart3, UserCog, Check, X } from "lucide-react";
import { getAllRoles, updateRolePermissions, AllRolesData, PermissionUpdate } from "@/features/admin/api/roles.api";
import { Button } from "@/components/ui/button";

const moduleIcons: Record<string, React.ElementType> = {
  fincas: Building2,
  bookings: Calendar,
  payments: CreditCard,
  users: Users,
  inbox: MessageSquare,
  contacts: UserCog,
  reviews: Star,
  catalogs: FileText,
  knowledge: BookOpen,
  reports: BarChart3,
  owner_info: UserCog,
};

export default function RolesPage() {
  const [data, setData] = useState<AllRolesData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>("admin");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const result = await getAllRoles();
      setData(result);
      if (result.roles.length > 0) {
        setSelectedRole(result.roles[0].value);
      }
    } catch (error) {
      console.error("Error loading roles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePermissionChange = (module: string, action: string, checked: boolean) => {
    if (!data) return;
    setData((prev) => {
      if (!prev) return prev;
      const newPermissions = { ...prev.permissions };
      const rolePerms = { ...(newPermissions[selectedRole] || {}) };
      const modulePerms = [...(rolePerms[module] || [])];
      if (checked) {
        if (!modulePerms.includes(action)) modulePerms.push(action);
      } else {
        const index = modulePerms.indexOf(action);
        if (index > -1) modulePerms.splice(index, 1);
      }
      rolePerms[module] = modulePerms;
      newPermissions[selectedRole] = rolePerms;
      return { ...prev, permissions: newPermissions };
    });
    setHasChanges(true);
  };

  const isPermissionChecked = (module: string, action: string): boolean => {
    if (!data) return false;
    return (data.permissions[selectedRole]?.[module] || []).includes(action);
  };

  const getPermissionsCount = (role: string): number => {
    if (!data) return 0;
    const rolePerms = data.permissions[role] || {};
    return Object.values(rolePerms).reduce((acc, perms) => acc + perms.length, 0);
  };

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    try {
      const permissionsToUpdate: PermissionUpdate[] = data.modules.map((mod) => ({
        module: mod.value,
        permissions: data.permissions[selectedRole]?.[mod.value] || [],
      }));
      await updateRolePermissions(selectedRole, permissionsToUpdate);
      setHasChanges(false);
      setSavedMessage("Permisos guardados exitosamente");
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (error) {
      console.error("Error saving:", error);
      setSavedMessage("Error al guardar permisos");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando roles y permisos...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center">
          <X className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-muted-foreground">Error al cargar los datos</p>
        </div>
      </div>
    );
  }

  const selectedRoleLabel = data.roles.find(r => r.value === selectedRole)?.label || selectedRole;
  const currentPermissionsCount = getPermissionsCount(selectedRole);
  const totalPermissions = data.modules.length * data.actions.length;

  return (
    <div className="p-4 md:p-8 lg:p-12 space-y-8 bg-transparent min-h-[calc(100vh-4rem)] relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Roles y Permisos
            </h1>
            <p className="text-[10px] md:text-xs text-muted-foreground mt-1 font-bold uppercase tracking-wider opacity-60">
              Configura los permisos de acceso por rol
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {savedMessage && (
            <span className={`text-sm font-medium px-4 py-2 rounded-full ${
              savedMessage.includes("Error") 
                ? "bg-red-100 text-red-700" 
                : "bg-green-100 text-green-700"
            }`}>
              {savedMessage.includes("Error") ? <X className="w-4 h-4 inline mr-1" /> : <Check className="w-4 h-4 inline mr-1" />}
              {savedMessage}
            </span>
          )}
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="px-6 py-3 rounded-xl font-bold shadow-lg shadow-primary/20"
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Guardar Cambios
          </Button>
        </div>
      </div>

      {/* Role Cards */}
      <div className="rounded-[2rem] bg-background border border-border shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-border bg-gradient-to-r from-muted/30 to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Seleccionar Rol</h2>
              <p className="text-sm text-muted-foreground">Elige un rol para configurar sus permisos</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {data.roles.map((role) => {
              const permCount = getPermissionsCount(role.value);
              const isSelected = selectedRole === role.value;
              return (
                <button
                  key={role.value}
                  onClick={() => { setSelectedRole(role.value); setHasChanges(false); }}
                  className={`relative p-4 rounded-2xl text-left transition-all duration-300 ${
                    isSelected 
                      ? "bg-primary text-white shadow-lg shadow-primary/25 scale-[1.02]" 
                      : "bg-muted/50 hover:bg-muted hover:scale-[1.01] border border-transparent hover:border-border"
                  }`}
                >
                  <div className={`font-semibold text-sm mb-1 ${isSelected ? "text-white" : ""}`}>
                    {role.label}
                  </div>
                  <div className={`text-xs ${isSelected ? "text-white/70" : "text-muted-foreground"}`}>
                    {permCount}/{totalPermissions} permisos
                  </div>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-white rounded-full animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Permissions Matrix */}
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Permisos de {selectedRoleLabel}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {currentPermissionsCount} de {totalPermissions} permisos activos
              </p>
            </div>
            <div className="flex gap-2">
              {data.actions.map((action) => (
                <span 
                  key={action.value} 
                  className="px-3 py-1 rounded-full text-xs font-medium bg-muted"
                >
                  {action.label}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {data.modules.map((module, index) => {
              const Icon = moduleIcons[module.value] || Shield;
              const activePermissions = (data.permissions[selectedRole]?.[module.value] || []).length;
              
              return (
                <div 
                  key={module.value}
                  className="group relative grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center p-4 rounded-xl hover:bg-muted/50 transition-all duration-200 border border-transparent hover:border-border"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* Module Info */}
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      activePermissions > 0 
                        ? "bg-primary/10 text-primary" 
                        : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-medium">{module.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {activePermissions} de {data.actions.length} permisos
                      </div>
                    </div>
                  </div>

                  {/* Checkboxes */}
                  {data.actions.map((action) => {
                    const isChecked = isPermissionChecked(module.value, action.value);
                    return (
                      <div key={action.value} className="flex justify-center">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => handlePermissionChange(module.value, action.value, e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className={`w-11 h-6 rounded-full transition-all duration-200 ${
                            isChecked 
                              ? "bg-primary shadow-lg shadow-primary/30" 
                              : "bg-muted hover:bg-muted/80"
                          }`}>
                            <div className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-transform duration-200 flex items-center justify-center ${
                              isChecked ? "translate-x-5" : "translate-x-0"
                            }`}>
                              {isChecked && <Check className="w-3 h-3 text-primary" />}
                            </div>
                          </div>
                        </label>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200/50 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Información Importante</h3>
            <ul className="text-sm text-blue-800 space-y-2">
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                Los permisos configurados se aplicarán a todos los usuarios con este rol
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                El rol Administrador tiene acceso completo por defecto
              </li>
              <li className="flex items-start gap-2">
                <Check className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                Cliente (client) es el rol por defecto para nuevos registros públicos
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}