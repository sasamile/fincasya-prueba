"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags, Plus } from "lucide-react";
import { setContactTags } from "@/features/admin/api/contacts.api";
import { sileo } from "sileo";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  INBOX_SUGGESTED_TAGS,
  isSuggestedInboxTag,
} from "@/features/inbox/lib/conversation-suggested-tags";
import { inboxTagChipClassNameLight } from "@/features/inbox/lib/tag-chip-styles";
import { cn } from "@/lib/utils";

type ContactTagsCellProps = {
  contactId: string;
  tags: string[];
  hasConversation: boolean;
};

export function ContactTagsCell({
  contactId,
  tags,
  hasConversation,
}: ContactTagsCellProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [customTagInput, setCustomTagInput] = useState("");

  const tagsMutation = useMutation({
    mutationFn: (nextTags: string[]) => setContactTags(contactId, nextTags),
    onMutate: async (nextTags) => {
      await queryClient.cancelQueries({ queryKey: ["admin-contacts"] });
      const previous = queryClient.getQueriesData({ queryKey: ["admin-contacts"] });
      queryClient.setQueriesData(
        { queryKey: ["admin-contacts"] },
        (old: unknown) => {
          if (!Array.isArray(old)) return old;
          return old.map((c: { _id: string; tags?: string[] }) =>
            c._id === contactId ? { ...c, tags: nextTags } : c,
          );
        },
      );
      return { previous };
    },
    onError: (err: unknown, _nextTags, context) => {
      if (context?.previous) {
        for (const [key, data] of context.previous) {
          queryClient.setQueryData(key, data);
        }
      }
      const msg =
        err instanceof Error ? err.message : "No se pudieron guardar las etiquetas";
      sileo.error({ title: msg, fill: "#fee2e2" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contacts"] });
    },
  });

  const saveTags = (next: string[]) => {
    if (!hasConversation) return;
    tagsMutation.mutate(next);
  };

  const toggleTag = (tag: string) => {
    const cur = tags ?? [];
    const next = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
    saveTags(next);
  };

  const addCustomTag = () => {
    const v = customTagInput.trim();
    if (!v) return;
    const cur = tags ?? [];
    if (cur.some((t) => t.toLowerCase() === v.toLowerCase())) {
      sileo.info({ title: "Esa etiqueta ya está aplicada" });
      return;
    }
    saveTags([...cur, v]);
    setCustomTagInput("");
  };

  const removeTag = (tag: string) => {
    saveTags((tags ?? []).filter((t) => t !== tag));
  };

  const preview = (tags ?? []).slice(0, 3);
  const more = (tags ?? []).length - preview.length;

  if (!hasConversation) {
    return (
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
        Sin chat
      </span>
    );
  }

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      {preview.map((tag) => (
        <span
          key={tag}
          className={cn(
            "inline-flex max-w-[120px] truncate rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
            inboxTagChipClassNameLight(tag),
          )}
          title={tag}
        >
          {tag}
        </span>
      ))}
      {more > 0 && (
        <span className="text-[10px] font-bold text-muted-foreground">+{more}</span>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 rounded-lg border-dashed px-2 text-[10px] font-bold"
          >
            <Tags className="h-3 w-3" />
            {(tags?.length ?? 0) > 0 ? "Editar" : "Etiquetas"}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[min(100vw-2rem,300px)] p-3"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Etiquetas del chat
          </p>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
            Las mismas etiquetas del inbox. Se sincronizan en todas las conversaciones
            de este contacto.
          </p>
          <div className="mt-3 max-h-52 space-y-0.5 overflow-y-auto pr-0.5">
            {INBOX_SUGGESTED_TAGS.map((tag) => {
              const checked = (tags ?? []).includes(tag);
              return (
                <label
                  key={tag}
                  className="flex cursor-pointer items-start gap-2 rounded-md py-1.5 pr-1 pl-0.5 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={checked}
                    disabled={tagsMutation.isPending}
                    onCheckedChange={() => toggleTag(tag)}
                    className="mt-0.5"
                  />
                  <span className="text-[13px] leading-snug">{tag}</span>
                </label>
              );
            })}
          </div>
          <div className="mt-3 border-t pt-3">
            <p className="mb-2 text-[11px] font-medium text-muted-foreground">
              Personalizada
            </p>
            <div className="flex gap-2">
              <Input
                value={customTagInput}
                onChange={(e) => setCustomTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomTag();
                  }
                }}
                placeholder="Ej. grupo 15 pax"
                className="h-9 text-[13px]"
                disabled={tagsMutation.isPending}
              />
              <Button
                type="button"
                size="sm"
                className="h-9 shrink-0"
                onClick={addCustomTag}
                disabled={!customTagInput.trim() || tagsMutation.isPending}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          {(tags ?? []).filter((t) => !isSuggestedInboxTag(t)).length > 0 && (
            <div className="mt-3 space-y-1.5">
              <p className="text-[11px] font-medium text-muted-foreground">Extras</p>
              {(tags ?? [])
                .filter((t) => !isSuggestedInboxTag(t))
                .map((tag) => (
                  <div
                    key={tag}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12px]">{tag}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[11px]"
                      disabled={tagsMutation.isPending}
                      onClick={() => removeTag(tag)}
                    >
                      Quitar
                    </Button>
                  </div>
                ))}
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
}
