export function normalizeLegalHtml(html: string) {
  if (!html) return "";

  try {
    const ORANGE = "#E8571F";
    const ORANGE_LIGHT = "#FFF3ED";

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    doc.querySelectorAll("script, style").forEach((el) => el.remove());
    doc.querySelectorAll("header.header, section.hero, nav.toc").forEach((el) =>
      el.remove(),
    );

    const container =
      doc.querySelector("main.content") ??
      doc.querySelector("main") ??
      doc.body;

    container.querySelectorAll("a[href]").forEach((a) => {
      const href = a.getAttribute("href");
      if (!href) return;
      a.setAttribute("href", href.replace(/`/g, "").trim());
    });

    container.querySelectorAll<HTMLElement>("h2.section-title").forEach((el) => {
      el.style.color = ORANGE;
      el.style.borderBottom = `2px solid ${ORANGE_LIGHT}`;
      el.style.paddingBottom = "8px";
      el.style.marginBottom = "14px";
    });

    container.querySelectorAll<HTMLElement>(".important").forEach((el) => {
      el.style.borderLeft = `4px solid ${ORANGE}`;
      el.style.background = ORANGE_LIGHT;
      el.style.padding = "12px 14px";
      el.style.borderRadius = "12px";
    });

    container.querySelectorAll<HTMLElement>("ul.legal-list").forEach((ul) => {
      ul.style.listStyle = "none";
      ul.style.paddingLeft = "0";
      ul.style.marginBottom = "12px";
    });

    container.querySelectorAll<HTMLElement>("ol.legal-numbered").forEach((ol) => {
      ol.style.paddingLeft = "20px";
      ol.style.marginBottom = "12px";
    });

    container.querySelectorAll<HTMLElement>("ul.legal-list > li").forEach((li) => {
      if (li.querySelector(":scope > span[data-legal-bullet]")) return;
      li.style.position = "relative";
      li.style.paddingLeft = "18px";
      li.style.marginBottom = "6px";

      const bullet = doc.createElement("span");
      bullet.setAttribute("data-legal-bullet", "true");
      bullet.textContent = "•";
      bullet.style.position = "absolute";
      bullet.style.left = "4px";
      bullet.style.top = "0";
      bullet.style.color = ORANGE;
      bullet.style.fontWeight = "800";
      li.prepend(bullet);
    });

    container.querySelectorAll<HTMLElement>(".tag").forEach((el) => {
      el.style.display = "inline-block";
      el.style.padding = "2px 10px";
      el.style.borderRadius = "9999px";
      el.style.fontSize = "12px";
      el.style.fontWeight = "700";
      el.style.lineHeight = "18px";

      const isGreen = el.classList.contains("tag-green");
      const isYellow = el.classList.contains("tag-yellow");
      const isRed = el.classList.contains("tag-red");

      if (isGreen) {
        el.style.background = "#DCFCE7";
        el.style.color = "#166534";
      } else if (isYellow) {
        el.style.background = "#FEF9C3";
        el.style.color = "#854D0E";
      } else if (isRed) {
        el.style.background = "#FEE2E2";
        el.style.color = "#991B1B";
      } else {
        el.style.background = "#F3F4F6";
        el.style.color = "#111827";
      }
    });

    container.querySelectorAll("table").forEach((table) => {
      const wrapper = doc.createElement("div");
      wrapper.style.overflowX = "auto";
      wrapper.style.borderRadius = "12px";
      wrapper.style.border = "1px solid rgba(0,0,0,0.08)";
      wrapper.style.background = "white";

      table.style.width = "100%";
      table.style.borderCollapse = "collapse";

      table.querySelectorAll("th").forEach((th) => {
        const thEl = th as HTMLElement;
        thEl.style.background = ORANGE;
        thEl.style.color = "white";
        thEl.style.textAlign = "left";
        thEl.style.padding = "10px 12px";
        thEl.style.fontWeight = "700";
        thEl.style.fontSize = "13px";
      });

      table.querySelectorAll("td").forEach((td) => {
        const tdEl = td as HTMLElement;
        tdEl.style.padding = "10px 12px";
        tdEl.style.borderTop = "1px solid rgba(0,0,0,0.08)";
        tdEl.style.fontSize = "13px";
      });

      wrapper.appendChild(table);
      table.replaceWith(wrapper);
    });

    return container.innerHTML;
  } catch {
    return html;
  }
}
