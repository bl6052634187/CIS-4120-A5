const DEFAULT_LATEX_TEMPLATE = ``;

function createNewDocument(name, content) {
  const now = Date.now();
  return {
    id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeCssColor(value) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return `#${trimmed.toUpperCase()}`;
  }
  return trimmed;
}

function applyFakeTextFormatting(html) {
  // Very simple replacements: good enough for preview/export, but does not handle nesting
  return html
    .replace(/\\textbf\{([^}]*)\}/g, "<strong>$1</strong>")
    .replace(/\\textit\{([^}]*)\}/g, "<em>$1</em>")
    .replace(/\\underline\{([^}]*)\}/g, '<span style="text-decoration:underline">$1</span>')
    .replace(/\\textcolor\{([^}]*)\}\{([^}]*)\}/g, (match, color, text) => {
      return `<span style="color:${normalizeCssColor(color)}">${text}</span>`;
    })
    .replace(/\\colorbox\{([^}]*)\}\{([^}]*)\}/g, (match, bg, text) => {
      const cssBg = normalizeCssColor(bg);
      return `<span style="background-color:${cssBg}; padding:0 0.15em; border-radius:3px">${text}</span>`;
    })
    .replace(/\\color\{([^}]*)\}\{([^}]*)\}/g, (match, color, text) => {
      return `<span style="color:${normalizeCssColor(color)}">${text}</span>`;
    })
    .replace(/\\fcolorbox\{([^}]*)\}\{([^}]*)\}\{([^}]*)\}/g, (match, frame, bg, text) => {
      const cssFrame = normalizeCssColor(frame);
      const cssBg = normalizeCssColor(bg);
      return `<span style="border:1px solid ${cssFrame}; background-color:${cssBg}; padding:0 0.15em; border-radius:3px">${text}</span>`;
    });
}

// Helper: strip a single pair of surrounding dollar signs when nesting math snippets
function stripOuterMathDelimiters(snippet) {
  if (typeof snippet !== "string") return snippet;
  if (snippet.length >= 2 && snippet[0] === "$" && snippet[snippet.length - 1] === "$") {
    return snippet.slice(1, -1);
  }
  return snippet;
}

function normalizeHexColor(color) {
  if (!color) return "000000";
  let sanitized = color.trim().replace("#", "");
  if (sanitized.length === 3) {
    sanitized = sanitized
      .split("")
      .map((ch) => `${ch}${ch}`)
      .join("");
  }
  if (sanitized.length !== 6) {
    return "000000";
  }
  return sanitized.toUpperCase();
}

function ensureXcolorPackage(source) {
  const colorDirective = "\\usepackage[HTML]{xcolor}";
  if (/\\usepackage(\[[^\]]*\])?\{xcolor\}/i.test(source)) {
    return source;
  }
  const docClassMatch = source.match(/\\documentclass(?:\[[^\]]*\])?\{[^}]+\}/i);
  if (docClassMatch && docClassMatch.index !== undefined) {
    const insertPos = docClassMatch.index + docClassMatch[0].length;
    return `${source.slice(0, insertPos)}\n${colorDirective}${source.slice(insertPos)}`;
  }
  return `${colorDirective}\n${source}`;
}

function LatexEditor({ currentUser }) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef(null);
  const [openCategories, setOpenCategories] = React.useState({
    "Basic": false,
    "Text Formatting": false,
    "Calculus": false,
    "Algebra": false,
    "Greek Letters": false,
    "Sets & Logic": false,
    "Matrices": true
  });
  const [activeSnippet, setActiveSnippet] = React.useState(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const [editorRatio, setEditorRatio] = React.useState(0.5); // 50/50 split
  const editorPreviewRef = React.useRef(null);
  const [documents, setDocuments] = React.useState([]);
  const [currentDocId, setCurrentDocId] = React.useState(null);
  const [highlightColor, setHighlightColor] = React.useState("#fff59d");
  const [textColor, setTextColor] = React.useState("#e53e3e");
  const [sizeModalMode, setSizeModalMode] = React.useState(null); // 'matrix' | 'table' | null
  const [sizeRows, setSizeRows] = React.useState(2);
  const [sizeCols, setSizeCols] = React.useState(2);
  const [modalInsertHandler, setModalInsertHandler] = React.useState(null);

  const handleChange = (e) => setText(e.target.value);
  const handleClear = () => setText("");

  const handleCopyEditor = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else if (textareaRef.current) {
        const textarea = textareaRef.current;
        const previousSelectionStart = textarea.selectionStart;
        const previousSelectionEnd = textarea.selectionEnd;
        textarea.select();
        document.execCommand("copy");
        textarea.setSelectionRange(previousSelectionStart, previousSelectionEnd);
      }
    } catch (e) {
      // Silently ignore clipboard errors to avoid disrupting the editor UX
    }
  };

  const insertSnippet = (snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end);

    // Adjust snippet for context: if it is wrapped in dollar signs and being inserted
    // inside existing math, strip the outer `$...$` so nested expressions don't break.
    let adjustedSnippet = snippet;
    if (typeof snippet === "string" && snippet.startsWith("$") && snippet.endsWith("$")) {
      const charBefore = textBefore.length > 0 ? textBefore[textBefore.length - 1] : "";
      const charAfter = textAfter.length > 0 ? textAfter[0] : "";
      const nonWhitespace = (ch) => ch && !/\s/.test(ch);

      const likelyNestedContext =
        nonWhitespace(charBefore) || nonWhitespace(charAfter);

      if (likelyNestedContext) {
        adjustedSnippet = stripOuterMathDelimiters(snippet);
      }
    }

    const prefix =
      start > 0 && textBefore[textBefore.length - 1] !== " " ? " " : "";
    const newText = textBefore + prefix + adjustedSnippet + textAfter;
    const newCursorPos = start + prefix.length + adjustedSnippet.length;

    textarea.focus();
    textarea.setSelectionRange(start, end);
    document.execCommand("insertText", false, prefix + adjustedSnippet);
    setText(newText);
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const generateMatrixLatex = (rows, cols) => {
    const body = Array.from({ length: rows })
      .map((_, r) =>
        Array.from({ length: cols })
          .map((_, c) => `a_{${r + 1}${c + 1}}`)
          .join(" & ")
      )
      .join(" \\\\\n");
    return `$\\begin{pmatrix}\n${body}\n\\end{pmatrix}$`;
  };

  const generateTableLatex = (rows, cols) => {
    const colSpec = Array.from({ length: cols }).map(() => "c").join("|");
    const body = Array.from({ length: rows })
      .map((_, r) =>
        Array.from({ length: cols })
          .map((_, c) => `cell${r + 1}${c + 1}`)
          .join(" & ")
      )
      .join(" \\\\\n");
    return `\\begin{tabular}{${colSpec}}\n${body}\n\\end{tabular}`;
  };

  const getStorageKey = () =>
    `easylatex_docs_${currentUser && currentUser.email ? currentUser.email : "guest"}`;

  // Load documents for current user
  React.useEffect(() => {
    const key = getStorageKey();
    let loaded = [];
    try {
      const raw = localStorage.getItem(key);
      loaded = raw ? JSON.parse(raw) : [];
    } catch (e) {
      loaded = [];
    }

    if (!loaded || loaded.length === 0) {
      const initialDoc = createNewDocument("Document 1", DEFAULT_LATEX_TEMPLATE);
      loaded = [initialDoc];
    }

    setDocuments(loaded);
    setCurrentDocId(loaded[0].id);
    setText(loaded[0].content);
  }, [currentUser]);

  // Persist documents whenever they change
  const persistDocuments = (docs) => {
    const key = getStorageKey();
    try {
      localStorage.setItem(key, JSON.stringify(docs));
    } catch (e) {
      // ignore storage errors
    }
  };

  // Keep current document content in sync with text
  React.useEffect(() => {
    if (!currentDocId) return;
    setDocuments((prev) => {
      const updated = prev.map((doc) =>
        doc.id === currentDocId ? { ...doc, content: text, updatedAt: Date.now() } : doc
      );
      persistDocuments(updated);
      return updated;
    });
  }, [text, currentDocId]);

  const handleNewDocument = () => {
    const name = `Document ${documents.length + 1}`;
    const newDoc = createNewDocument(name, DEFAULT_LATEX_TEMPLATE);
    const updated = [...documents, newDoc];
    setDocuments(updated);
    setCurrentDocId(newDoc.id);
    setText(newDoc.content);
    persistDocuments(updated);
  };

  const handleSelectDocument = (id) => {
    const target = documents.find((d) => d.id === id);
    if (!target) return;
    setCurrentDocId(target.id);
    setText(target.content);
  };

  const handleExportPdf = () => {
    const currentDoc = documents.find((d) => d.id === currentDocId);
    const fileName = currentDoc ? currentDoc.name : "document";
    const trimmed = text.trim();

    const win = window.open("", "_blank");
    if (!win) return;

    const escapeHtml = (str) =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    let bodyHtml = "";
    if (trimmed) {
      // Check if content has tables
      const hasTables = trimmed.includes("\\begin{tabular}");
      
      if (!hasTables) {
        // No tables - render normally
        // No tables - render normally
        const isFullDocument =
          trimmed.includes("\\begin{document}") ||
          trimmed.includes("\\documentclass");

        if (window.latexjs) {
          try {
            const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
            const source = isFullDocument
              ? trimmed
              : `\\documentclass{article}
\\begin{document}
${trimmed}
\\end{document}`;
            const finalSource = ensureXcolorPackage(source);
            window.latexjs.parse(finalSource, { generator });
            const temp = document.createElement("div");
            temp.appendChild(generator.domFragment());
            bodyHtml = applyFakeTextFormatting(temp.innerHTML);
          } catch (e) {
            bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
          }
        } else if (window.katex) {
          try {
            const rendered = window.katex.renderToString(trimmed, {
              throwOnError: false,
              displayMode: true,
            });
            bodyHtml = rendered;
          } catch (e) {
            bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
          }
        } else {
          bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
        }
      } else {
        // Has tables - extract and render parts separately
        let parts, tabulars;
        try {
          const result = extractTabulars(trimmed);
          parts = result.parts;
          tabulars = result.tabulars;
        } catch (e) {
          console.error('Error extracting tabulars for PDF:', e);
          // Fallback: render as plain text
          bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
          // Continue to write the document
        }
        
        if (!parts || parts.length === 0) {
          bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
        } else {
          const htmlParts = [];
          
          parts.forEach((part, index) => {
          try {
            if (part.type === 'tabular') {
              // Render table to HTML
              const tableContainer = document.createElement("div");
              renderSimpleTabular(tableContainer, part.fullMatch);
              const tableHtml = tableContainer.innerHTML;
              if (tableHtml) {
                htmlParts.push(tableHtml);
              } else {
                // Fallback if table rendering fails
                htmlParts.push(`<pre>${escapeHtml(part.fullMatch)}</pre>`);
              }
            } else if (part.text !== undefined) {
              const contentText = part.text || '';
              // Always render first and last parts, skip empty middle parts
              if (!contentText.trim() && index !== 0 && index !== parts.length - 1) {
                return;
              }
              
              const isFullDocument =
                contentText.includes("\\begin{document}") ||
                contentText.includes("\\documentclass");

              if (window.latexjs) {
                const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
                const source = isFullDocument
                  ? contentText
                  : `\\documentclass{article}
\\begin{document}
${contentText}
\\end{document}`;
                const finalSource = ensureXcolorPackage(source);
                window.latexjs.parse(finalSource, { generator });
                const temp = document.createElement("div");
                temp.appendChild(generator.domFragment());
                const html = applyFakeTextFormatting(temp.innerHTML);
                htmlParts.push(html);
              } else if (window.katex) {
                const rendered = window.katex.renderToString(contentText, {
                  throwOnError: false,
                  displayMode: true,
                });
                htmlParts.push(rendered);
              } else {
                htmlParts.push(`<pre>${escapeHtml(contentText)}</pre>`);
              }
            }
          } catch (e) {
            console.error('Error rendering part for PDF:', e, part);
            // Fallback: render as plain text
            htmlParts.push(`<pre>${escapeHtml(part.type === 'tabular' ? part.fullMatch : (part.text || ''))}</pre>`);
          }
          });
          
          bodyHtml = htmlParts.join('');
          
          // Debug: log if bodyHtml is empty
          if (!bodyHtml || bodyHtml.trim() === '') {
            console.error('PDF export: bodyHtml is empty after processing parts', parts);
            bodyHtml = `<pre>${escapeHtml(trimmed)}</pre>`;
          }
        }
      }
    }
    
    // Ensure we always have some HTML
    if (!bodyHtml || bodyHtml.trim() === '') {
      bodyHtml = `<pre>${escapeHtml(trimmed || 'Empty document')}</pre>`;
    }

    const latexCssHref = "https://cdn.jsdelivr.net/npm/latex.js@0.12.6/dist/latex.css";
    const katexCssHref = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css";

    win.document.open();
    win.document.write(`<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>${fileName}</title>
    <link rel="stylesheet" href="${latexCssHref}" />
    <link rel="stylesheet" href="${katexCssHref}" />
    <style>
      @page { size: letter; margin: 1in; }
      body { margin: 1in; word-wrap: break-word; overflow-wrap: anywhere; }
      pre { white-space: pre-wrap; word-wrap: break-word; overflow-wrap: anywhere; font-family: "Courier New", monospace; font-size: 12px; }
      table { border-collapse: collapse; margin: 1rem 0; width: 100%; border: 1px solid #cbd5e0; }
      table td { border: 1px solid #cbd5e0; padding: 0.5rem 0.75rem; text-align: center; }
    </style>
  </head>
  <body>
    ${bodyHtml}
    <script>
      if (window.print) {
        window.print();
      }
    </script>
  </body>
</html>`);
    win.document.close();
  };

  const applyToSelection = (transformFn) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return; // nothing selected

    const before = text.slice(0, start);
    const selected = text.slice(start, end);
    const after = text.slice(end);

    const transformed = transformFn(selected);
    const newText = before + transformed + after;

    setText(newText);

    const newStart = start;
    const newEnd = start + transformed.length;

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 0);
  };

  const applyHighlight = () => {
    const bgHex = normalizeHexColor(highlightColor);
    const textHex = normalizeHexColor(textColor);
    applyToSelection(
      (selected) =>
        `\\color{${textHex}} \\fcolorbox{${bgHex}}{${bgHex}}{${selected}}`
    );
  };

  const applyTextColor = () => {
    const hex = normalizeHexColor(textColor);
    applyToSelection((selected) => `\\color{${hex}}{${selected}}`);
  };


  // Drag-to-resize behavior between editor and preview
  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing || !editorPreviewRef.current) return;

      const rect = editorPreviewRef.current.getBoundingClientRect();
      const offsetX = e.clientX - rect.left;
      if (rect.width <= 0) return;

      let ratio = offsetX / rect.width;
      // Keep each pane at least 20% wide
      const minRatio = 0.2;
      const maxRatio = 0.8;
      if (ratio < minRatio) ratio = minRatio;
      if (ratio > maxRatio) ratio = maxRatio;

      setEditorRatio(ratio);
    };

    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const toggleCategory = (categoryName) => {
    setOpenCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const latexCategories = [
    {
      name: "Basic",
      items: [
        { label: "⁄ Fraction", interactive: true, fields: ["numerator", "denominator"], template: "$\\frac{{{numerator}}}{{{denominator}}}$", mathContext: true },
        { label: "√ Square Root", interactive: true, fields: ["radicand"], template: "$\\sqrt{{{radicand}}}$", mathContext: true },
        { label: "ⁿ√ Nth Root", interactive: true, fields: ["n", "radicand"], template: "$\\sqrt[{{n}}]{{{radicand}}}$", mathContext: true },
        { label: "√⁄ Fraction Within Root", interactive: true, fields: ["numerator", "denominator"], template: "$\\sqrt{\\frac{{{numerator}}}{{{denominator}}}}$", mathContext: true },
        { label: "Superscript: a^2", interactive: true, fields: ["base", "exponent"], template: "${{base}}^{{{exponent}}}$", mathContext: true },
        { label: "Subscript: a_2", interactive: true, fields: ["base", "subscript"], template: "${{base}}_{{{subscript}}}$", mathContext: true },
        // Quick inline math snippets for nesting (shown only in nested-math mode)
        { label: "a_2", code: "$a_2$", allowedInMath: true, nestedOnly: true },
        { label: "a^2", code: "$a^2$", allowedInMath: true, nestedOnly: true },
        { label: "√x", code: "$\\sqrt{x}$", allowedInMath: true, nestedOnly: true },
        { label: "a/b", code: "$\\frac{a}{b}$", allowedInMath: true, nestedOnly: true },
      ]
    },
    {
      name: "Text Formatting",
      items: [
        { label: "Bold Text", code: "$\\text{\\textbf{text}}$", allowedInMath: true },
        { label: "Italic Text", code: "$\\text{\\textit{text}}$", allowedInMath: true },
        { label: "Underline", code: "$\\text{\\underline{text}}$", allowedInMath: true },
        { label: "Bold Math", code: "$\\mathbf{x}$", allowedInMath: true },
        { label: "Blackboard Bold", code: "$\\mathbb{R}$", allowedInMath: true },
        { label: "Calligraphic", code: "$\\mathcal{A}$", allowedInMath: true },
        { label: "Roman Math", code: "$\\mathrm{text}$", allowedInMath: true },
        { label: "Text in Math", code: "$\\text{text}$", allowedInMath: true },
        { label: "Section Heading", code: "\\section{Title}", allowedInMath: false },
        { label: "Subsection Heading", code: "\\subsection{Subtitle}", allowedInMath: false },
        { label: "Subsubsection Heading", code: "\\subsubsection{Sub-subtitle}", allowedInMath: false },
        { label: "Bullet List (itemize)", code: "$\\bullet \\text{ First item} \\\\ \n \\bullet \\text{ Second item} \\\\ \n \\bullet \\text{ Third item}$", allowedInMath: false },
        { label: "Numbered List (enumerate)", code: "$\\text{1. First item} \\\\ \n \\text{2. Second item} \\\\ \n \\text{3. Third item}$", allowedInMath: false },
        { label: "Description List", code: "\\begin{description}\n  \\item[Term 1] Definition 1\n  \\item[Term 2] Definition 2\n\\end{description}", allowedInMath: false },
      ]
    },
    {
      name: "Calculus",
      items: [
        { label: "∫ Integral", interactive: true, fields: ["lower", "upper", "function"], 
          template: "$\\int_{{{lower}}}^{{{upper}}} {{{function}}} dx$" },
        { label: "∬ Double Integral", interactive: true, fields: ["region", "function", "integration variable"], 
          template: "$\\iint_{{{region}}} {{function}} d{{integration variable}}$" },
        { label: "∮ Contour Integral", interactive: true, fields: ["region", "function", "integration variable"], 
          template: "$\\oint_{{{region}}} {{function}} d{{integration variable}}$" },
        { label: "∂ Partial Derivative", interactive: true, fields: ["function", "variable"], 
          template: "$\\frac{\\partial {{function}}}{\\partial {{variable}}}$" },
        { label: "∇ Gradient", interactive: true, fields: ["function"], 
          template: "$\\nabla {{function}}$" },
        { label: "lim Limit", interactive: true, fields: ["limit variable", "limit", "function"], 
          template: "$\\lim_{{{limit variable}} \\to {{limit}}} {{function}}$" },
      ]
    },
    {
      name: "Algebra",
      items: [
        { label: "Σ Summation", interactive: true, fields: ["index", "start", "end", "expression"], 
          template: "$\\sum_{{{index}}={{{start}}}}^{{{end}}} {{{expression}}}$", mathContext: true },
        { label: "∏ Product", interactive: true, fields: ["index", "start", "end", "expression"], 
          template: "$\\prod_{{{index}}={{{start}}}}^{{{end}}} {{{expression}}}$", mathContext: true },
        { label: "± Plus/Minus", code: "$\\pm$" },
        { label: "≠ Not Equal", code: "$\\neq$" },
        { label: "≈ Approximately", code: "$\\approx$" },
        { label: "≤ Less or Equal", code: "$\\leq$" },
        { label: "≥ Greater or Equal", code: "$\\geq$" },
      ]
    },
    {
      name: "Greek Letters",
      items: [
        { label: "α Alpha", code: "$\\alpha$" },
        { label: "β Beta", code: "$\\beta$" },
        { label: "γ Gamma", code: "$\\gamma$" },
        { label: "δ Delta", code: "$\\delta$" },
        { label: "θ Theta", code: "$\\theta$" },
        { label: "λ Lambda", code: "$\\lambda$" },
        { label: "π Pi", code: "$\\pi$" },
        { label: "σ Sigma", code: "$\\sigma$" },
        { label: "Σ Capital Sigma", code: "$\\Sigma$" },
        { label: "Ω Omega", code: "$\\Omega$" },
      ]
    },
    {
      name: "Sets & Logic",
      items: [
        { label: "∈ Element of", code: "$\\in$" },
        { label: "∉ Not Element", code: "$\\notin$" },
        { label: "⊂ Subset", code: "$\\subset$" },
        { label: "∪ Union", code: "$\\cup$" },
        { label: "∩ Intersection", code: "$\\cap$" },
        { label: "∅ Empty Set", code: "$\\emptyset$" },
        { label: "∀ For All", code: "$\\forall$" },
        { label: "∃ Exists", code: "$\\exists$" },
      ]
    },
    {
      name: "Matrices",
      items: [
        { label: "2×2 Matrix", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "$\\begin{pmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{pmatrix}$" },
        { label: "3×3 Matrix", interactive: true, fields: ["a11", "a12", "a13", "a21", "a22", "a23", "a31", "a32", "a33"], 
          template: "$\\begin{pmatrix} {{a11}} & {{a12}} & {{a13}} \\\\ {{a21}} & {{a22}} & {{a23}} \\\\ {{a31}} & {{a32}} & {{a33}} \\end{pmatrix}$" },
        { label: "Determinant", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "$\\begin{vmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{vmatrix}$" },
        { label: "Bracket Matrix", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "$\\begin{bmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{bmatrix}$" },
        { label: "Custom Matrix (m×n)", code: "__CUSTOM_MATRIX__", allowedInMath: false },
        { label: "Custom Table (rows×cols)", code: "__CUSTOM_TABLE__", allowedInMath: false },
      ]
    }
  ];

  const containerStyle = {
    background: "white",
    borderRadius: "20px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    display: "flex",
    minHeight: "100vh",
    width: "100%",
    overflow: "hidden",
  };
  const sidebarStyle = {
    width: "280px",
    background: "linear-gradient(180deg, #667eea 0%, #764ba2 100%)",
    padding: "2rem 1.5rem",
    overflowY: "auto",
    flexShrink: 0,
  };
  const mainContentStyle = {
    flex: 1,
    padding: "3rem",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  const editorPreviewContainerStyle = {
    display: "flex",
    gap: "2rem",
    alignItems: "stretch",
    marginBottom: "2rem",
    minHeight: "80vh",
    flex: 1,
    overflow: "hidden",
  };
  const editorSectionStyle = {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    position: "relative",
  };
  const previewSectionStyle = {
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };
  const dividerStyle = {
    width: "6px",
    background: "#e2e8f0",
    borderRadius: "999px",
    cursor: "col-resize",
    alignSelf: "stretch",
    flexShrink: 0,
  };
  const headerStyle = {
    fontSize: "2.5rem",
    fontWeight: "700",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: 0,
    textAlign: "center",
  };

  const categoryHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.75rem",
    marginTop: "1rem",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    border: "1px solid rgba(255, 255, 255, 0.2)",
  };
  const firstCategoryHeaderStyle = { ...categoryHeaderStyle, marginTop: "0" };
  const categoryTitleStyle = { fontSize: "0.875rem", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)", 
    textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 };
  const chevronStyle = { fontSize: "0.75rem", color: "rgba(255, 255, 255, 0.9)", transition: "transform 0.3s ease" };
  const snippetButtonStyle = {
    width: "100%",
    padding: "0.75rem 1rem",
    fontSize: "0.875rem",
    fontWeight: "500",
    color: "white",
    background: "rgba(255, 255, 255, 0.15)",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s ease",
    marginBottom: "0.5rem",
    textAlign: "left",
    backdropFilter: "blur(10px)",
  };
  const categoryContentStyle = {
    overflow: "hidden",
    transition: "max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, margin 0.3s ease",
  };
  const sectionTitleStyle = {
    fontSize: "1rem",
    fontWeight: "600",
    color: "#4a5568",
    marginBottom: "1rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };
  const textareaStyle = {
    width: "100%",
    padding: "1.25rem",
    fontSize: "1rem",
    fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    resize: "none",
    minHeight: 0,
    flex: 1,
    transition: "all 0.3s ease",
    outline: "none",
    lineHeight: "1.6",
  };
  const clearButtonStyle = {
    padding: "0.875rem 2rem",
    fontSize: "0.95rem",
    fontWeight: "500",
    color: "#e53e3e",
    background: "white",
    border: "2px solid #e53e3e",
    borderRadius: "10px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    marginTop: "1rem",
  };
  const headerRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2rem",
  };
  const headerActionsStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
  };
  const docSelectStyle = {
    padding: "0.5rem 2.5rem 0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e0",
    fontSize: "0.85rem",
    fontWeight: "500",
    background: "white",
    cursor: "pointer",
    color: "#4a5568",
    appearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%234a5568' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.75rem center",
    transition: "all 0.2s ease",
    outline: "none",
  };
  const headerSmallButtonStyle = {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid #cbd5e0",
    background: "white",
    fontSize: "0.85rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s ease",
    color: "#4a5568",
  };
  const editorHeaderRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "0.75rem",
  };
  const editorCopyButtonStyle = {
    ...headerSmallButtonStyle,
    fontSize: "0.8rem",
    padding: "0.4rem 0.9rem",
  };
  const colorControlsRowStyle = {
    display: "flex",
    gap: "1rem",
    alignItems: "center",
    marginTop: "0.75rem",
    flexWrap: "wrap",
  };
  const colorGroupStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.4rem",
  };
  const colorLabelStyle = {
    fontSize: "0.8rem",
    fontWeight: "500",
    color: "#4a5568",
  };
  const colorInputStyle = {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    border: "1px solid #cbd5e0",
    padding: 0,
    cursor: "pointer",
  };
  const smallActionButtonStyle = {
    padding: "0.45rem 0.85rem",
    fontSize: "0.8rem",
    borderRadius: "999px",
    border: "1px solid #cbd5e0",
    background: "white",
    cursor: "pointer",
  };


  const openSizeModal = (mode) => {
    setSizeModalMode(mode);
    setSizeRows(2);
    setSizeCols(2);
  };

  const handleCreateFromSizeModal = () => {
    const rows = Math.max(1, Math.min(10, Number(sizeRows) || 1));
    const cols = Math.max(1, Math.min(10, Number(sizeCols) || 1));

    let code = "";
    if (sizeModalMode === "matrix") {
      code = generateMatrixLatex(rows, cols);
    } else if (sizeModalMode === "table") {
      code = generateTableLatex(rows, cols);
    }

    if (code) {
      insertSnippet(code);
    }
    setSizeModalMode(null);
  };

  return (
    <div style={containerStyle}>
      <div style={sidebarStyle}>
        <h2 style={{ color: "white", fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>LaTeX Snippets</h2>
        {latexCategories.map((category, categoryIndex) => {
          const isOpen = openCategories[category.name];

          // During nested math mode, compute only the items that are allowed.
          const visibleItems = modalInsertHandler
            ? category.items.filter((item) => {
                if (item.allowedInMath === false) return false;
                if (item.interactive) return false;
                if (!item.code) return false;
                return true;
              })
            : category.items.filter((item) => !item.nestedOnly);

          // If there are no visible items for this category in nested mode, skip it entirely.
          if (modalInsertHandler && visibleItems.length === 0) {
            return null;
          }

          return (
            <div key={category.name}>
              <div
                style={categoryIndex === 0 ? firstCategoryHeaderStyle : categoryHeaderStyle}
                onClick={() => toggleCategory(category.name)}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)"}
              >
                <h3 style={categoryTitleStyle}>{category.name}</h3>
                <span style={{ ...chevronStyle, transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              </div>
              <div style={{ ...categoryContentStyle, maxHeight: isOpen ? "2000px" : "0px", opacity: isOpen ? 1 : 0, marginTop: isOpen ? "0.5rem" : "0", marginBottom: isOpen ? "0.5rem" : "0" }}>
                {visibleItems.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    style={snippetButtonStyle}
                    onClick={() => {
                      if (modalInsertHandler && !item.interactive && item.code && item.allowedInMath !== false) {
                        // Insert directly into the currently focused field of the open modal
                        modalInsertHandler(item.code);
                      } else if (item.interactive) {
                        setActiveSnippet(item);
                      } else if (item.code === "__CUSTOM_MATRIX__") {
                        openSizeModal("matrix");
                      } else if (item.code === "__CUSTOM_TABLE__") {
                        openSizeModal("table");
                      } else {
                        insertSnippet(item.code);
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.25)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255, 255, 255, 0.15)";
                      e.currentTarget.style.transform = "translateX(0)";
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={mainContentStyle}>
        <div style={headerRowStyle}>
        <h1 style={headerStyle}>Easy LaTeX Editor</h1>
          <div style={headerActionsStyle}>
            <select
              style={docSelectStyle}
              value={currentDocId || ""}
              onChange={(e) => handleSelectDocument(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#667eea";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(102, 126, 234, 0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#cbd5e0";
                e.currentTarget.style.boxShadow = "none";
              }}
              onMouseEnter={(e) => {
                if (document.activeElement !== e.currentTarget) {
                  e.currentTarget.style.borderColor = "#a0aec0";
                }
              }}
              onMouseLeave={(e) => {
                if (document.activeElement !== e.currentTarget) {
                  e.currentTarget.style.borderColor = "#cbd5e0";
                }
              }}
            >
              {documents.map((doc) => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              style={headerSmallButtonStyle}
              onClick={handleNewDocument}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f7fafc";
                e.currentTarget.style.borderColor = "#667eea";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#cbd5e0";
              }}
            >
              New
            </button>
            <button
              type="button"
              style={headerSmallButtonStyle}
              onClick={handleExportPdf}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f7fafc";
                e.currentTarget.style.borderColor = "#667eea";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#cbd5e0";
              }}
            >
              Export PDF
            </button>
            <button
              type="button"
              style={{
                ...headerSmallButtonStyle,
                borderColor: "#e53e3e",
                color: "#e53e3e",
              }}
              onClick={handleClear}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#e53e3e";
                e.currentTarget.style.color = "white";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.color = "#e53e3e";
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div style={editorPreviewContainerStyle} ref={editorPreviewRef}>
          <div style={{ ...editorSectionStyle, flex: editorRatio }}>
          <div style={editorHeaderRowStyle}>
            <h2 style={sectionTitleStyle}>Editor</h2>
            <button
              type="button"
              style={editorCopyButtonStyle}
              onClick={handleCopyEditor}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f7fafc";
                e.currentTarget.style.borderColor = "#667eea";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "white";
                e.currentTarget.style.borderColor = "#cbd5e0";
              }}
            >
              Copy LaTeX
            </button>
          </div>

          <textarea
            ref={textareaRef}
            style={textareaStyle}
            placeholder="Select a template from the left toolbar, then customize the LaTeX here..."
            value={text}
            onChange={handleChange}
            onFocus={(e) => e.currentTarget.style.borderColor = "#667eea"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
          />
        </div>

          <div
            style={dividerStyle}
            onMouseDown={() => setIsResizing(true)}
          />

          <div style={{ ...previewSectionStyle, flex: 1 - editorRatio }}>
          <h2 style={sectionTitleStyle}>Preview</h2>
          <Preview content={text} />
          </div>
        </div>
      </div>

      {activeSnippet && (
        <SnippetModal
          snippet={activeSnippet}
          onInsert={insertSnippet}
          onClose={() => {
            setActiveSnippet(null);
            setModalInsertHandler(null);
          }}
          onRegisterInsertHandler={setModalInsertHandler}
        />
      )}

      {sizeModalMode && (
        <SizeModal
          mode={sizeModalMode}
          rows={sizeRows}
          cols={sizeCols}
          setRows={setSizeRows}
          setCols={setSizeCols}
          onCreate={handleCreateFromSizeModal}
          onClose={() => setSizeModalMode(null)}
        />
      )}
    </div>
  );
}

// Modal for interactive snippets
function SnippetModal({ snippet, onInsert, onClose, onRegisterInsertHandler }) {
  const [values, setValues] = React.useState(
    () => snippet.fields.reduce((acc, f) => ({ ...acc, [f]: "" }), {})
  );

  const handleChange = (field, val) => setValues(prev => ({ ...prev, [field]: val }));

  const handleInsert = () => {
    let code = snippet.template;
    Object.keys(values).forEach(k => {
      code = code.replaceAll(`{{${k}}}`, values[k]);
      code = code.replaceAll(`{{{${k}}}}`, values[k]);
    });
    onInsert(code);
    onClose();
  };

  // Convert template + values into preview LaTeX
  const [focused, setFocused] = React.useState({});

  const handleFocus = (field) => {
    setFocused(prev => ({ ...prev, [field]: true }));
  };

  // Allow toolbar snippets to insert into the currently focused field
  React.useEffect(() => {
    if (!onRegisterInsertHandler) return;

    const handler = (latex) => {
      const activeField = Object.keys(focused).find((f) => focused[f]);
      if (!activeField) return;

      const toInsert = stripOuterMathDelimiters(latex);
      setValues((prev) => ({
        ...prev,
        [activeField]: (prev[activeField] || "") + toInsert,
      }));
    };

    // Store handler in parent state (wrap so React doesn't treat function as updater)
    onRegisterInsertHandler(() => handler);

    return () => {
      onRegisterInsertHandler(() => null);
    };
  }, [focused, onRegisterInsertHandler]);

  const renderPreviewString = () => {
    let code = snippet.template;
    Object.keys(values).forEach(k => {
      let val = values[k];
      if (!val) {
        val = focused[k] ? "\\color{red}{\\Box}" : "\\color{black}{\\Box}";
      }
      code = code.replaceAll(`{{${k}}}`, val);
      code = code.replaceAll(`{{{${k}}}}`, val);
    });
    return code;
  };


  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    // Allow clicks to pass through to the left toolbar while the modal is open
    pointerEvents: "none",
  };
  const modalStyle = {
    background: "white",
    padding: "2rem",
    borderRadius: "12px",
    minWidth: "350px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
    pointerEvents: "auto",
  };
  const inputStyle = {
    width: "100%", marginBottom: "1rem", padding: "0.5rem 0.75rem", fontSize: "1rem",
    borderRadius: "6px", border: "1px solid #ccc"
  };
  const buttonStyle = { padding: "0.5rem 1rem", marginRight: "0.5rem", borderRadius: "6px", cursor: "pointer" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: "0.5rem" }}>{snippet.label}</h3>
        <p
          style={{
            marginBottom: "0.9rem",
            fontSize: "0.8rem",
            color: "#4a5568",
          }}
        >
          You can click math snippets in the left sidebar while this window is open to build nested expressions.
        </p>

        {snippet.fields.map(f => (
          <input
            key={f}
            style={inputStyle}
            placeholder={f}
            value={values[f]}
            onChange={e => handleChange(f, e.target.value)}
            onFocus={() => handleFocus(f)}
          />
        ))}

        <div style={{ margin: "1rem 0", padding: "0.75rem", background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: "6px", fontSize: "1.25rem" }}>
          <Preview content={renderPreviewString()} />
        </div>

        <div style={{ textAlign: "right", marginTop: "0.5rem" }}>
          <button style={buttonStyle} onClick={handleInsert}>Insert</button>
          <button style={buttonStyle} onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

function SizeModal({
  mode,
  rows,
  cols,
  setRows,
  setCols,
  onCreate,
  onClose,
}) {
  const overlayStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  };
  const modalStyle = {
    background: "white",
    padding: "2rem",
    borderRadius: "12px",
    minWidth: "320px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
  };
  const labelStyle = {
    fontSize: "0.9rem",
    fontWeight: "500",
    color: "#4a5568",
    marginBottom: "0.25rem",
  };
  const inputStyle = {
    width: "100%",
    marginBottom: "1rem",
    padding: "0.5rem 0.75rem",
    fontSize: "1rem",
    borderRadius: "6px",
    border: "1px solid #cbd5e0",
  };
  const buttonRowStyle = {
    textAlign: "right",
    marginTop: "0.5rem",
  };
  const buttonStyle = {
    padding: "0.5rem 1rem",
    marginLeft: "0.5rem",
    borderRadius: "6px",
    cursor: "pointer",
    border: "1px solid #cbd5e0",
    background: "white",
  };

  const title =
    mode === "matrix" ? "Custom Matrix (m×n)" : "Custom Table (rows×cols)";

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: "1rem" }}>{title}</h3>
        <div>
          <div>
            <div style={labelStyle}>Rows</div>
            <input
              type="number"
              min="1"
              max="10"
              value={rows}
              onChange={(e) => setRows(e.target.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <div style={labelStyle}>Columns</div>
            <input
              type="number"
              min="1"
              max="10"
              value={cols}
              onChange={(e) => setCols(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>
        <div style={buttonRowStyle}>
          <button style={buttonStyle} onClick={onClose}>
            Cancel
          </button>
          <button style={buttonStyle} onClick={onCreate}>
            Insert
          </button>
        </div>
      </div>
    </div>
  );
}

function renderSimpleTabular(container, latexSource) {
  // Remove math mode wrappers ($...$) if present
  let cleanedSource = latexSource.replace(/^\$+|\$+$/g, '');
  
  const match = cleanedSource.match(/\\begin{tabular}\{([^}]*)\}([\s\S]*?)\\end{tabular}/);
  if (!match) {
    const pre = document.createElement("pre");
    pre.textContent = latexSource;
    container.appendChild(pre);
    return;
  }

  const body = match[2].trim();
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.margin = "1rem 0";
  table.style.width = "100%";
  table.style.border = "1px solid #cbd5e0";

  const rows = body.split(/\\\\\s*/);
  rows.forEach((rowStr) => {
    const rowContent = rowStr.trim();
    if (!rowContent) return;
    const tr = document.createElement("tr");
    rowContent.split("&").forEach((cellStr) => {
      const td = document.createElement("td");
      td.textContent = cellStr.trim();
      td.style.border = "1px solid #cbd5e0";
      td.style.padding = "0.5rem 0.75rem";
      td.style.textAlign = "center";
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });

  container.appendChild(table);
}

function renderLaTeXContent(contentText, targetContainer) {
  if (!contentText || !contentText.trim()) return;
  
  try {
    const isFullDocument =
      contentText.includes("\\begin{document}") ||
      contentText.includes("\\documentclass");

    if (window.latexjs) {
      const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
      const source = isFullDocument
        ? contentText
        : `\\documentclass{article}
\\begin{document}
${contentText}
\\end{document}`;
      const finalSource = ensureXcolorPackage(source);
      window.latexjs.parse(finalSource, { generator });
      const temp = document.createElement("div");
      temp.appendChild(generator.domFragment());
      const html = applyFakeTextFormatting(temp.innerHTML);
      targetContainer.innerHTML = html;
    } else if (window.katex) {
      window.katex.render(contentText, targetContainer, {
        throwOnError: false,
        displayMode: true,
      });
    } else {
      const pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = contentText;
      targetContainer.appendChild(pre);
    }
  } catch (e) {
    console.error('Error rendering LaTeX content:', e);
    const pre = document.createElement("pre");
    pre.style.whiteSpace = "pre-wrap";
    pre.textContent = contentText;
    targetContainer.appendChild(pre);
  }
}

function extractTabulars(content) {
  const tabularRegex = /\\begin{tabular}\{([^}]*)\}([\s\S]*?)\\end{tabular}/g;
  const tabulars = [];
  const parts = [];
  let lastIndex = 0;
  let match;
  
  // Find all tabular environments and split content around them
  while ((match = tabularRegex.exec(content)) !== null) {
    // Add content before this tabular
    if (match.index > lastIndex) {
      parts.push({
        type: 'content',
        text: content.substring(lastIndex, match.index)
      });
    }
    
    // Add tabular
    parts.push({
      type: 'tabular',
      fullMatch: match[0],
      colSpec: match[1],
      body: match[2]
    });
    tabulars.push({
      fullMatch: match[0],
      colSpec: match[1],
      body: match[2]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining content after last tabular
  if (lastIndex < content.length) {
    parts.push({
      type: 'content',
      text: content.substring(lastIndex)
    });
  }
  
  // If no tabulars found, return single content part
  if (tabulars.length === 0) {
    return { parts: [{ type: 'content', text: content }], tabulars: [] };
  }
  
  return { parts, tabulars };
}

function Preview({ content }) {
  const previewRef = React.useRef();
  React.useEffect(() => {
    const container = previewRef.current;
    if (!container) return;

    container.innerHTML = "";
    const trimmed = content.trim();
    if (!trimmed) return;

    // Extract tabular environments and split content
    const { parts, tabulars } = extractTabulars(trimmed);

    try {
      // If no tabulars found, render normally without splitting
      if (tabulars.length === 0) {
        const isFullDocument =
          trimmed.includes("\\begin{document}") ||
          trimmed.includes("\\documentclass");

        if (window.latexjs) {
          const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
          const source = isFullDocument
            ? trimmed
            : `\\documentclass{article}
\\begin{document}
${trimmed}
\\end{document}`;
          const finalSource = ensureXcolorPackage(source);
          window.latexjs.parse(finalSource, { generator });
          const temp = document.createElement("div");
          temp.appendChild(generator.domFragment());
          const html = applyFakeTextFormatting(temp.innerHTML);
          container.innerHTML = html;
        } else if (window.katex) {
          window.katex.render(trimmed, container, {
            throwOnError: false,
            displayMode: true,
          });
        } else {
          const pre = document.createElement("pre");
          pre.style.whiteSpace = "pre-wrap";
          pre.textContent = trimmed;
          container.appendChild(pre);
        }
        return;
      }

      // Render each part separately
      parts.forEach((part, index) => {
        try {
          if (part.type === 'tabular') {
            // Render table
            renderSimpleTabular(container, part.fullMatch);
          } else if (part.text !== undefined) {
            // Render LaTeX content - always render, even if empty (to preserve structure)
            const contentText = part.text || '';
            
            // Skip only if it's completely empty AND it's not the first or last part
            if (!contentText.trim() && index !== 0 && index !== parts.length - 1) {
              return;
            }
            
            const isFullDocument =
              contentText.includes("\\begin{document}") ||
              contentText.includes("\\documentclass");

            if (window.latexjs) {
              const generator = new window.latexjs.HtmlGenerator({ hyphenate: false });
              const source = isFullDocument
                ? contentText
                : `\\documentclass{article}
\\begin{document}
${contentText}
\\end{document}`;
              const finalSource = ensureXcolorPackage(source);
              window.latexjs.parse(finalSource, { generator });
              const temp = document.createElement("div");
              temp.appendChild(generator.domFragment());
              const html = applyFakeTextFormatting(temp.innerHTML);
              
              // Create a wrapper div for this content part
              const contentDiv = document.createElement("div");
              contentDiv.innerHTML = html;
              container.appendChild(contentDiv);
            } else if (window.katex) {
              const contentDiv = document.createElement("div");
              window.katex.render(contentText, contentDiv, {
                throwOnError: false,
                displayMode: true,
              });
              container.appendChild(contentDiv);
            } else {
              const pre = document.createElement("pre");
              pre.style.whiteSpace = "pre-wrap";
              pre.textContent = contentText;
              container.appendChild(pre);
            }
          }
        } catch (partError) {
          console.error('Error rendering part:', partError, part);
          // If a part fails, render it as plain text
          const pre = document.createElement("pre");
          pre.style.whiteSpace = "pre-wrap";
          pre.textContent = part.type === 'tabular' ? part.fullMatch : (part.text || '');
          container.appendChild(pre);
        }
      });
    } catch (e) {
      console.error('Error rendering LaTeX:', e);
      // Fallback: render as plain text
      const pre = document.createElement("pre");
      pre.style.whiteSpace = "pre-wrap";
      pre.textContent = trimmed;
      container.appendChild(pre);
    }
  }, [content]);

  return (
    <div
      ref={previewRef}
      style={{
        background: "#f7fafc",
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        border: "2px solid #e2e8f0",
        borderRadius: "10px",
        padding: "2rem",
        minHeight: 0,
        fontSize: "1.25rem",
        width: "100%",
        maxWidth: "800px",
        margin: "0 auto",
        overflowX: "auto",
        overflowY: "auto",
        transition: "all 0.3s ease",
        flex: 1,
      }}
    ></div>
  );
}

// Simple localStorage helpers for local auth
function loadUsers() {
  try {
    const raw = localStorage.getItem("easylatex_users");
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveUsers(users) {
  try {
    localStorage.setItem("easylatex_users", JSON.stringify(users));
  } catch (e) {
    // ignore write errors for local-only demo auth
  }
}

function LandingPage({ onGetStarted }) {
  const pageStyle = {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "2.5rem 1.5rem",
  };

  const shellStyle = {
    width: "100%",
    maxWidth: "1080px",
  };

  const headerStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "2.5rem",
  };

  const brandStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  };

  const brandIconStyle = {
    width: "2rem",
    height: "2rem",
    borderRadius: "999px",
    background: "rgba(15,23,42,0.55)",
    border: "1px solid rgba(226,232,240,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontSize: "0.9rem",
    fontWeight: "600",
  };

  const brandTextStyle = {
    fontSize: "1.05rem",
    fontWeight: "600",
    color: "#E2E8F0",
  };

  const headerButtonStyle = {
    padding: "0.45rem 1.15rem",
    borderRadius: "999px",
    border: "1px solid rgba(226,232,240,0.9)",
    background: "rgba(15,23,42,0.15)",
    color: "#E2E8F0",
    fontSize: "0.8rem",
    fontWeight: "500",
    cursor: "pointer",
  };

  const mainStyle = {
    display: "grid",
    gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2.5fr)",
    gap: "2.75rem",
    alignItems: "center",
  };

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.25rem 0.85rem",
    borderRadius: "999px",
    fontSize: "0.72rem",
    fontWeight: "600",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    background: "rgba(15,23,42,0.45)",
    color: "#CBD5F5",
    marginBottom: "0.9rem",
    border: "1px solid rgba(148,163,184,0.6)",
  };
 
  const titleStyle = {
    fontSize: "2.6rem",
    lineHeight: 1.15,
    fontWeight: "800",
    color: "#F7FAFC",
    marginBottom: "0.5rem",
    maxWidth: "30rem",
  };

  const accentSpanStyle = {
    color: "#E9D8FD",
    fontWeight: "800",
  };

  const bodyStyle = {
    fontSize: "0.95rem",
    color: "#E2E8F0",
    maxWidth: "30rem",
    marginBottom: "0.6rem",
  };

  const bulletListStyle = {
    listStyle: "none",
    padding: 0,
    margin: "0.3rem 0 0",
  };
 
  const bulletItemStyle = {
    display: "flex",
    alignItems: "flex-start",
    gap: "0.45rem",
    fontSize: "0.88rem",
    color: "#E2E8F0",
    marginBottom: "0.25rem",
  };
 
  const bulletDotStyle = {
    width: "0.45rem",
    height: "0.45rem",
    borderRadius: "999px",
    background: "#48BB78",
    marginTop: "0.38rem",
    flexShrink: 0,
  };

  const ctaRowStyle = {
    display: "flex",
    alignItems: "center",
    gap: "0.9rem",
    marginTop: "1.25rem",
  };

  const primaryButtonStyle = {
    padding: "0.9rem 1.8rem",
    borderRadius: "999px",
    border: "none",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
    background: "#F7FAFC",
    color: "#4C51BF",
    boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
  };

  const helperTextStyle = {
    fontSize: "0.8rem",
    color: "#E2E8F0",
    opacity: 0.85,
  };

  // Removed detailed three-step cards to keep hero lighter

  const panelStyle = {
    background: "rgba(15,23,42,0.92)",
    borderRadius: "18px",
    padding: "1.4rem 1.3rem",
    boxShadow: "0 18px 48px rgba(15,23,42,0.85)",
    border: "1px solid rgba(148,163,184,0.55)",
    color: "#E2E8F0",
  };

  const panelTitleStyle = {
    fontSize: "0.8rem",
    textTransform: "uppercase",
    letterSpacing: "0.1em",
    color: "#A0AEC0",
    marginBottom: "0.9rem",
  };

  const miniLabelStyle = {
    fontSize: "0.78rem",
    color: "#A0AEC0",
    marginBottom: "0.35rem",
  };

  const codeBlockStyle = {
    fontFamily: "'Menlo', 'Monaco', monospace",
    fontSize: "0.85rem",
    background: "#020617",
    borderRadius: "10px",
    border: "1px solid rgba(30,64,175,0.8)",
    padding: "0.8rem 0.9rem",
    marginBottom: "0.7rem",
    whiteSpace: "pre-wrap",
  };

  const latexBlockStyle = {
    ...codeBlockStyle,
    background: "#020617",
    border: "1px solid rgba(51,65,85,0.9)",
  };

  const mathPreviewStyle = {
    fontSize: "1.4rem",
    background: "#F7FAFC",
    color: "#1A202C",
    borderRadius: "10px",
    padding: "0.9rem 1rem",
    border: "1px solid #E2E8F0",
  };

  return (
    <div style={pageStyle}>
      <div style={shellStyle}>
        <header style={headerStyle}>
          <div style={brandStyle}>
            <div style={brandIconStyle}>EL</div>
            <div style={brandTextStyle}>Easy LaTeX</div>
          </div>
          <button type="button" style={headerButtonStyle} onClick={onGetStarted}>
            Open editor
          </button>
        </header>

        <main style={mainStyle}>
          <div>
            <div style={badgeStyle}>Equation editor for modern math workflows</div>
            <h1 style={titleStyle}>
              LaTeX&apos;s power{" "}
              <span style={accentSpanStyle}>without its steep learning curve.</span>
            </h1>
            <p style={bodyStyle}>
              Easy LaTeX is a guided editor for equations — start from a template, fill in a few
              labeled fields, and get clean LaTeX plus beautifully typeset math for homework, exams,
              and quick notes.
            </p>
            <div style={ctaRowStyle}>
              <button type="button" style={primaryButtonStyle} onClick={onGetStarted}>
                Start writing equations
              </button>
              <span style={helperTextStyle}>Local‑only demo — your LaTeX stays in this browser.</span>
            </div>

          </div>

          <aside style={panelStyle}>
            <div style={panelTitleStyle}>From template to LaTeX in seconds</div>
            <div style={{ marginBottom: "0.65rem" }}>
              <div style={miniLabelStyle}>You select a template and fill in values</div>
              <div style={codeBlockStyle}>
                {`Integral template
lower bound:   a
upper bound:   b
function:      f(x)`}
              </div>
            </div>
            <div style={{ marginBottom: "0.65rem" }}>
              <div style={miniLabelStyle}>Easy LaTeX generates the code</div>
              <div style={latexBlockStyle}>{`\\int_{a}^{b} f(x) \\, dx`}</div>
            </div>
            <div>
              <div style={miniLabelStyle}>And shows you the formatted math</div>
              <div style={mathPreviewStyle}>∫<sub>a</sub><sup>b</sup> f(x) dx</div>
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}

function AuthPage({ onAuthSuccess, onBackToLanding }) {
  const [mode, setMode] = React.useState("signup"); // "login" | "signup"
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  const authWrapperStyle = {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const cardStyle = {
    width: "100%",
    maxWidth: "420px",
    background: "rgba(255,255,255,0.98)",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    padding: "2.5rem 2.75rem",
  };

  const titleStyle = {
    fontSize: "2rem",
    fontWeight: "700",
    textAlign: "center",
    marginBottom: "0.5rem",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
  };

  const subtitleStyle = {
    fontSize: "0.95rem",
    color: "#4a5568",
    textAlign: "center",
    marginBottom: "1.75rem",
  };

  const labelStyle = {
    fontSize: "0.85rem",
    fontWeight: "600",
    color: "#4a5568",
    marginBottom: "0.35rem",
    display: "block",
  };

  const inputStyle = {
    width: "100%",
    padding: "0.75rem 0.9rem",
    borderRadius: "10px",
    border: "1px solid #cbd5e0",
    fontSize: "0.95rem",
    marginBottom: "1rem",
    outline: "none",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
  };

  const primaryButtonStyle = {
    width: "100%",
    padding: "0.9rem 1rem",
    borderRadius: "999px",
    border: "none",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "white",
    fontSize: "0.95rem",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "0.5rem",
    marginBottom: "0.75rem",
  };

  const toggleTextStyle = {
    fontSize: "0.85rem",
    color: "#4a5568",
    textAlign: "center",
  };

  const toggleLinkStyle = {
    color: "#667eea",
    fontWeight: "600",
    cursor: "pointer",
    marginLeft: "0.25rem",
  };

  const errorStyle = {
    fontSize: "0.85rem",
    color: "#e53e3e",
    background: "#fff5f5",
    borderRadius: "8px",
    padding: "0.5rem 0.75rem",
    marginBottom: "0.75rem",
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setError("Please enter an email and password.");
      return;
    }

    const users = loadUsers();

    if (mode === "signup") {
      if (users[trimmedEmail]) {
        setError("An account with this email already exists.");
        return;
      }
      if (password.length < 6) {
        setError("Password should be at least 6 characters.");
        return;
      }

      const newUser = { email: trimmedEmail, password };
      users[trimmedEmail] = newUser;
      saveUsers(users);
      onAuthSuccess(newUser);
      return;
    }

    // login
    const existing = users[trimmedEmail];
    if (!existing || existing.password !== password) {
      setError("Invalid email or password.");
      return;
    }
    onAuthSuccess(existing);
  };

  return (
    <div style={authWrapperStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Easy LaTeX Editor</h1>
        <p style={subtitleStyle}>
          {mode === "login"
            ? "Log in to start editing your LaTeX snippets."
            : "Create a local account to use the editor on this device."}
        </p>

        {error && <div style={errorStyle}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <label style={labelStyle} htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            style={inputStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />

          <label style={labelStyle} htmlFor="password">
            Password
          </label>
          <input
            id="password"
            type="password"
            style={inputStyle}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password"
          />

          <button type="submit" style={primaryButtonStyle}>
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <div style={toggleTextStyle}>
          {mode === "login" ? "Need an account?" : "Already have an account?"}
          <span
            style={toggleLinkStyle}
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setError("");
            }}
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </span>
        </div>

        {onBackToLanding && (
          <div style={{ ...toggleTextStyle, marginTop: "0.75rem" }}>
            <span
              style={{ ...toggleLinkStyle, marginLeft: 0 }}
              onClick={onBackToLanding}
            >
              ← Back to home
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function App() {
  const [currentUser, setCurrentUser] = React.useState(() => {
    try {
      const raw = localStorage.getItem("easylatex_currentUser");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const [showLanding, setShowLanding] = React.useState(() => {
    try {
      const raw = localStorage.getItem("easylatex_showLanding");
      if (raw === "false") return false;
      return true;
    } catch (e) {
      return true;
    }
  });

  const handleAuthSuccess = (user) => {
    setCurrentUser(user);
    try {
      localStorage.setItem("easylatex_currentUser", JSON.stringify(user));
    } catch (e) {
      // ignore
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem("easylatex_currentUser");
    } catch (e) {
      // ignore
    }
    setShowLanding(true);
    try {
      localStorage.removeItem("easylatex_showLanding");
    } catch (e) {
      // ignore
    }
  };

  const handleDismissLanding = () => {
    setShowLanding(false);
    try {
      localStorage.setItem("easylatex_showLanding", "false");
    } catch (e) {
      // ignore
    }
  };

  if (!currentUser && showLanding) {
    return <LandingPage onGetStarted={handleDismissLanding} />;
  }

  const topRowStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "1rem",
    gap: "1rem",
  };

  const usageStepsStyle = {
    fontSize: "0.85rem",
    color: "#EDF2F7",
    background: "rgba(15,23,42,0.35)",
    borderRadius: "999px",
    padding: "0.45rem 0.85rem",
    display: "flex",
    alignItems: "center",
    gap: "0.6rem",
  };

  const usageStepEmphasisStyle = {
    fontWeight: "600",
    color: "#E9D8FD",
  };

  const topBarStyle = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginLeft: "auto",
    maxWidth: "420px",
    padding: "0.6rem 1.1rem",
    background: "rgba(255,255,255,0.9)",
    borderRadius: "999px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  };

  const topBarTextStyle = {
    fontSize: "0.9rem",
    color: "#4a5568",
  };

  const topBarButtonStyle = {
    fontSize: "0.85rem",
    padding: "0.4rem 0.9rem",
    borderRadius: "999px",
    border: "1px solid #cbd5e0",
    background: "white",
    cursor: "pointer",
  };

  if (!currentUser) {
    return (
      <AuthPage
        onAuthSuccess={handleAuthSuccess}
        onBackToLanding={() => {
          setShowLanding(true);
          try {
            localStorage.removeItem("easylatex_showLanding");
          } catch (e) {
            // ignore
          }
        }}
      />
    );
  }

  return (
    <div>
      <div style={topRowStyle}>
        <div style={usageStepsStyle}>
          <span style={usageStepEmphasisStyle}>1.</span>
          <span>Pick a template</span>
          <span style={usageStepEmphasisStyle}>2.</span>
          <span>Fill in the fields</span>
          <span style={usageStepEmphasisStyle}>3.</span>
          <span>Copy LaTeX or export PDF</span>
        </div>
        <div style={topBarStyle}>
          <span style={topBarTextStyle}>Signed in as {currentUser.email}</span>
          <button style={topBarButtonStyle} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </div>
      <LatexEditor currentUser={currentUser} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<App />);