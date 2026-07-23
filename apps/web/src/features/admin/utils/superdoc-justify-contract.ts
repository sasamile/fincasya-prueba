/**
 * SuperDoc pinta `justify` como `left` en CSS (usa word-spacing interno que
 * a menudo no se nota). Forzamos justificación en el modelo OOXML y en el DOM
 * para que la vista y el export (PDF) queden con renglones del mismo ancho.
 */
export function justifySuperDocContract(superdoc: unknown): void {
  const sd = superdoc as {
    activeEditor?: SuperDocEditorLike;
    editor?: SuperDocEditorLike;
  } | null;
  const editor = sd?.activeEditor ?? sd?.editor;
  if (!editor?.state?.doc || !editor.view) return;

  const { state } = editor;
  let tr = state.tr;
  let changed = false;

  state.doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    const props =
      (node.attrs?.paragraphProperties as Record<string, unknown> | undefined) ??
      {};
    const j = String(props.justification ?? "");
    if (j === "center") return;
    if (j === "both" || j === "justify") return;
    changed = true;
    tr = tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      paragraphProperties: {
        ...props,
        justification: "both",
      },
    });
  });

  if (changed) {
    editor.view.dispatch(tr);
  }

  const applyDom = () => {
    const root = editor.view.dom as HTMLElement | undefined;
    if (!root) return;
    // No solo `p`: según la plantilla, SuperDoc pinta párrafos como div o los
    // envuelve en nodos propios, y esos quedaban sin justificar — por eso el
    // contrato salía justificado a medias (Adriana, 22-jul).
    root
      .querySelectorAll('p, div[data-node-type="paragraph"], .sd-paragraph')
      .forEach((el) => {
        const node = el as HTMLElement;
        const inline = (node.getAttribute("style") || "").toLowerCase();
        if (
          inline.includes("text-align: center") ||
          inline.includes("text-align:center") ||
          inline.includes("text-align: right") ||
          inline.includes("text-align:right")
        ) {
          return;
        }
        node.style.setProperty("text-align", "justify", "important");
      });
  };

  applyDom();
  requestAnimationFrame(applyDom);
  // El documento termina de montarse en varios ticks (fuentes, imágenes): sin
  // estos reintentos, el primer pase justificaba solo lo que ya estaba pintado.
  for (const ms of [120, 400, 1000]) {
    setTimeout(applyDom, ms);
  }

  // Y al escribir, ProseMirror vuelve a pintar el párrafo tocado y le borra el
  // estilo: se reaplica en cada cambio.
  const onUpdate = () => requestAnimationFrame(applyDom);
  editor.on?.("update", onUpdate);
}

type SuperDocEditorLike = {
  on?: (event: string, handler: () => void) => void;
  state: {
    doc: {
      descendants: (
        f: (node: {
          type: { name: string };
          attrs: Record<string, unknown>;
        }, pos: number) => void,
      ) => void;
    };
    tr: {
      setNodeMarkup: (
        pos: number,
        type: undefined,
        attrs: Record<string, unknown>,
      ) => SuperDocEditorLike["state"]["tr"];
    };
  };
  view: {
    dispatch: (tr: SuperDocEditorLike["state"]["tr"]) => void;
    dom: HTMLElement;
  };
};
