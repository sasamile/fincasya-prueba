"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import type { Extensions } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Video,
  FileText,
  Loader2,
} from "lucide-react";
import { Toggle } from "./toggle";
import { Separator } from "./separator";
import { cn } from "@/lib/utils";
import { useEffect, useId, useRef, useState } from "react";
import { sileo } from "sileo";
import {
  uploadInternalPageImage,
  uploadInternalPageVideo,
  uploadInternalPageDocument,
} from "@/features/admin/api/internal-pages-media.api";
import {
  BLOG_DOCUMENT_ACCEPT,
  BLOG_CONTENT_PROSE_CLASSES,
  buildBlogDocumentEmbedHtml,
} from "@/features/blog/utils/blog-document-embed";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  className,
  placeholder,
}: RichTextEditorProps) {
  const imageInputId = useId();
  const videoInputId = useId();
  const documentInputId = useId();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline underline-offset-4 cursor-pointer",
        },
      }),
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: "max-w-full h-auto",
        },
      }).extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            src: { default: null },
            alt: { default: null },
            title: { default: null },
            width: { default: null },
            height: { default: null },
            style: { default: null },
          };
        },
      }),
    ] as Extensions,
    content: value,
    editorProps: {
      attributes: {
        class: cn(
          BLOG_CONTENT_PROSE_CLASSES,
          "min-h-[150px] p-4 focus:outline-hidden",
          className
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update content if value changes externally (e.g. on reset or initial load)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  const toggleLink = () => {
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = window.prompt("URL del enlace");
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  };

  const insertImageFromFile = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const url = await uploadInternalPageImage(file);
      editor.chain().focus().setImage({ src: url }).run();
    } catch {
      sileo.error({
        title: "Error al subir la imagen",
        description: "Intentá nuevamente",
        fill: "#fee2e2",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const insertVideoFromFile = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const url = await uploadInternalPageVideo(file);
      editor
        .chain()
        .focus()
        .insertContent(
          `<video controls playsinline class="max-w-full rounded-xl my-4" src="${url}"></video>`,
        )
        .run();
    } catch {
      sileo.error({
        title: "Error al subir el video",
        description: "Intentá nuevamente (MP4, WEBM, MOV — máx 150MB)",
        fill: "#fee2e2",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const insertDocumentFromFile = async (file: File) => {
    setIsUploadingMedia(true);
    try {
      const url = await uploadInternalPageDocument(file);
      editor
        .chain()
        .focus()
        .insertContent(buildBlogDocumentEmbedHtml(url, file.name))
        .run();
    } catch {
      sileo.error({
        title: "Error al subir el documento",
        description: "Intentá nuevamente (PDF, DOC, DOCX — máx 20MB)",
        fill: "#fee2e2",
      });
    } finally {
      setIsUploadingMedia(false);
    }
  };

  const insertVideoFromUrl = () => {
    const url = window.prompt("URL del video (YouTube, Vimeo o archivo .mp4)");
    if (!url?.trim()) return;

    const trimmed = url.trim();
    const youtubeMatch = trimmed.match(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/,
    );
    if (youtubeMatch?.[1]) {
      editor
        .chain()
        .focus()
        .insertContent(
          `<iframe class="aspect-video w-full max-w-full rounded-xl my-4" src="https://www.youtube.com/embed/${youtubeMatch[1]}" allowfullscreen></iframe>`,
        )
        .run();
      return;
    }

    editor
      .chain()
      .focus()
      .insertContent(
        `<video controls playsinline class="max-w-full rounded-xl my-4" src="${trimmed}"></video>`,
      )
      .run();
  };

  return (
    <div className="flex flex-col w-full border border-input rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all">
      <input
        id={imageInputId}
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void insertImageFromFile(file);
        }}
      />
      <input
        id={videoInputId}
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void insertVideoFromFile(file);
        }}
      />
      <input
        id={documentInputId}
        ref={documentInputRef}
        type="file"
        accept={BLOG_DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void insertDocumentFromFile(file);
        }}
      />
      <div className="flex flex-wrap items-center gap-1 p-2 bg-secondary/20 border-b border-input">
        <Toggle
          size="sm"
          pressed={editor.isActive("bold")}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
          aria-label="Toggle bold"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <Bold className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("italic")}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
          aria-label="Toggle italic"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <Italic className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("underline")}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
          aria-label="Toggle underline"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("bulletList")}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
          aria-label="Toggle bullet list"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <List className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={editor.isActive("orderedList")}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
          aria-label="Toggle ordered list"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <ListOrdered className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={editor.isActive("blockquote")}
          onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
          aria-label="Toggle blockquote"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <Quote className="h-4 w-4" />
        </Toggle>

        <Toggle
          size="sm"
          pressed={editor.isActive("link")}
          onPressedChange={toggleLink}
          aria-label="Toggle link"
          className="hover:bg-primary/10 data-[state=on]:bg-primary/20 data-[state=on]:text-primary"
        >
          <LinkIcon className="h-4 w-4" />
        </Toggle>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Toggle
          size="sm"
          pressed={false}
          disabled={isUploadingMedia}
          onPressedChange={() => imageInputRef.current?.click()}
          aria-label="Insertar imagen"
          className="hover:bg-primary/10"
        >
          {isUploadingMedia ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ImageIcon className="h-4 w-4" />
          )}
        </Toggle>
        <Toggle
          size="sm"
          pressed={false}
          disabled={isUploadingMedia}
          onPressedChange={() => videoInputRef.current?.click()}
          aria-label="Subir video"
          className="hover:bg-primary/10"
        >
          <Video className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={false}
          disabled={isUploadingMedia}
          onPressedChange={() => documentInputRef.current?.click()}
          aria-label="Subir documento"
          className="hover:bg-primary/10"
        >
          <FileText className="h-4 w-4" />
        </Toggle>
        <Toggle
          size="sm"
          pressed={false}
          onPressedChange={insertVideoFromUrl}
          aria-label="Insertar video por URL"
          className="hover:bg-primary/10"
        >
          <span className="text-[10px] font-bold uppercase tracking-wide">
            URL
          </span>
        </Toggle>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <Toggle
            size="sm"
            onPressedChange={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            aria-label="Undo"
            className="hover:bg-primary/10"
          >
            <Undo className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            onPressedChange={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            aria-label="Redo"
            className="hover:bg-primary/10"
          >
            <Redo className="h-4 w-4" />
          </Toggle>
        </div>
      </div>
      <EditorContent editor={editor} className="min-h-[150px]" />
    </div>
  );
}
