"use client";

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { sileo } from "sileo";
import { Calendar, Trash2, Users, BookOpen } from "lucide-react";
import type { BlogPost } from "@/features/admin/types/paginas-internas.types";
import { BlogPostForm } from "@/features/admin/components/content/blog-post-form";

interface BlogPostsTableProps {
  posts: BlogPost[];
  isLoading: boolean;
  onUpdatePost?: (post: BlogPost) => void | Promise<void>;
  onDeletePost?: (postId: number) => void | Promise<void>;
}

export function BlogPostsTable({
  posts,
  isLoading,
  onUpdatePost,
  onDeletePost,
}: BlogPostsTableProps) {
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const handleDelete = async () => {
    if (!postToDelete) return;
    try {
      const postId = Number(postToDelete);
      await onDeletePost?.(postId);
      sileo.success({
        title: "Publicación eliminada correctamente",
        fill: "#f0fdf4",
      });
    } catch (error) {
      sileo.error({
        title: "Error al eliminar la publicación",
        description: "Ocurrió un error inesperado",
        fill: "#fee2e2",
      });
    } finally {
      setPostToDelete(null);
    }
  };

  const handleOpenEdit = (post: BlogPost) => {
    setEditingPost(post);
  };

  if (isLoading) {
    return (
      <div className="divide-y divide-border/40">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <div className="w-14 h-10 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 bg-muted rounded animate-pulse" />
              <div className="h-3 w-24 bg-muted/50 rounded animate-pulse" />
            </div>
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!posts?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7 text-muted-foreground/30" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">
          No se encontraron publicaciones
        </p>
        <p className="text-muted-foreground/60 text-xs mt-1">
          Intenta crear una nueva publicación
        </p>
      </div>
    );
  }

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleDateString("es-CO", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="bg-background/50 backdrop-blur-sm">
      {/* Table Header */}
      <div className="hidden md:grid grid-cols-[60px_1fr_1.2fr_100px_100px_80px_80px] gap-4 px-8 py-5 bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
        <span>ID</span>
        <span>Título & Categoría</span>
        <span>Fecha</span>
        <span className="text-center">Tiempo lectura</span>
        <span className="text-center">Estado</span>
        <span className="text-right pr-4">Acciones</span>
      </div>

      {/* Table Body */}
      <div className="divide-y divide-border/50">
        {posts.map((post) => (
          <div
            key={post.id}
            onClick={() => handleOpenEdit(post)}
            className={`flex flex-col md:grid md:grid-cols-[60px_1fr_1.2fr_100px_100px_80px_80px] gap-4 md:gap-4 items-start md:items-center px-6 md:px-8 py-6 hover:bg-primary/5 transition-all group relative border-l-4 border-l-transparent hover:border-l-primary cursor-pointer ${post.active === false ? "opacity-60" : ""}`}
          >
            {/* Mobile Header (ID + Title + Edit Button) */}
            <div className="flex w-full md:hidden gap-4 items-center mb-2">
              <div className="w-10 h-8 rounded-lg overflow-hidden bg-muted shrink-0 flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                #{post.id}
              </div>
              <div className="flex-1 min-w-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(post);
                  }}
                  className="font-semibold text-xs text-foreground truncate block tracking-tight leading-tight text-left"
                >
                  {post.title}
                </button>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[8px] font-black text-white bg-primary px-1.5 py-0.5 rounded-full tracking-widest uppercase">
                    {post.category}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(post);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-primary bg-primary/10 shadow-sm active:scale-95 shrink-0"
              >
                <BookOpen className="w-4 h-4" />
              </button>
            </div>

            {/* Desktop ID */}
            <div className="w-12 h-10 rounded-xl overflow-hidden bg-muted shrink-0 hidden md:block items-center justify-center text-sm font-semibold text-muted-foreground/50">
              #{post.id}
            </div>

            {/* Desktop Name & Details */}
            <div className="min-w-0 hidden md:block">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(post);
                }}
                className="font-semibold text-sm text-foreground truncate group-hover:text-primary transition-colors block tracking-tight text-left"
              >
                {post.title}
              </button>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] font-semibold text-white bg-primary px-2 py-0.5 rounded-full tracking-widest uppercase shadow-sm">
                  {post.category}
                </span>
              </div>
            </div>

            {/* Date */}
            <div className="flex items-center justify-center w-full md:contents mt-2 md:mt-0">
              <span className="text-[9px] text-muted-foreground">{formatDate(post.date)}</span>
            </div>

            {/* Read Time */}
            <div className="flex items-center justify-center w-full md:contents mt-2 md:mt-0">
              <span className="text-[9px] font-semibold text-muted-foreground">
                {post.readTime} min
              </span>
            </div>

            {/* Status (Active/Inactive) */}
            <div className="flex items-center justify-center w-full md:contents mt-2 md:mt-0">
              <span
                className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${
                  post.active !== false
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {post.active !== false ? "Activa" : "Inactiva"}
              </span>
            </div>

            {/* Desktop Action buttons */}
            <div className="hidden md:flex justify-end gap-2 pr-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(post);
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground/50 hover:text-white hover:bg-primary transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-primary/20 active:scale-95 shrink-0"
              >
                <BookOpen className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPostToDelete(post.id.toString());
                }}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground/50 hover:text-white hover:bg-red-500 transition-all opacity-0 group-hover:opacity-100 shadow-sm hover:shadow-lg hover:shadow-red-200 active:scale-95 shrink-0 cursor-pointer"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Delete Confirmation Modal */}
      <AlertDialog
        open={!!postToDelete}
        onOpenChange={(open) => !open && setPostToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              la publicación y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              className="bg-red-500! hover:bg-red-600 text-white"
            >
              Sí, eliminar publicación
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={!!editingPost}
        onOpenChange={(open) => !open && setEditingPost(null)}
      >
        <DialogContent className="p-0 w-[95vw] max-w-5xl h-[90vh] overflow-hidden">
          <div className="h-[90vh] overflow-y-auto">
            {editingPost ? (
              <BlogPostForm
                isEditing
                initialData={editingPost}
                onCancel={() => setEditingPost(null)}
                onSave={async (values) => {
                  await onUpdatePost?.(values as BlogPost);
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
