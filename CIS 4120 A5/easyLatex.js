function LatexEditor() {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef(null);
  const [openCategories, setOpenCategories] = React.useState({
    "Basic": true,
    "Text Formatting": true,
    "Calculus": true,
    "Algebra": true,
    "Greek Letters": true,
    "Sets & Logic": true,
    "Matrices": true
  });
  const [activeSnippet, setActiveSnippet] = React.useState(null);

  const handleChange = (e) => setText(e.target.value);
  const handleClear = () => setText("");

  const insertSnippet = (snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end);

    const prefix = (start > 0 && textBefore[textBefore.length - 1] !== ' ') ? ' ' : '';
    const newText = textBefore + prefix + snippet + textAfter;
    const newCursorPos = start + prefix.length + snippet.length;

    textarea.focus();
    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, prefix + snippet);
    setText(newText);
    setTimeout(() => {
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

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
        { label: "⁄ Fraction", interactive: true, fields: ["numerator", "denominator"], template: "\\frac{{{numerator}}}{{{denominator}}}" },
        { label: "√ Square Root", interactive: true, fields: ["radicand"], template: "\\sqrt{{{radicand}}}" },
        { label: "ⁿ√ Nth Root", interactive: true, fields: ["n", "radicand"], template: "\\sqrt[{{n}}]{{{radicand}}}" },
        { label: "x² Superscript", interactive: true, fields: ["base", "exponent"], template: "{{base}}^{{{exponent}}}" },
        { label: "x₂ Subscript", interactive: true, fields: ["base", "subscript"], template: "{{base}}^{{{subscript}}}" },
      ]
    },
    {
      name: "Text Formatting",
      items: [
        { label: "Bold Text", code: "\\textbf{text}" },
        { label: "Italic Text", code: "\\textit{text}" },
        { label: "Underline", code: "\\underline{text}" },
        { label: "Bold Math", code: "\\mathbf{x}" },
        { label: "Blackboard Bold", code: "\\mathbb{R}" },
        { label: "Calligraphic", code: "\\mathcal{A}" },
        { label: "Roman Math", code: "\\mathrm{text}" },
        { label: "Text in Math", code: "\\text{text}" },
      ]
    },
    {
      name: "Calculus",
      items: [
        { label: "∫ Integral", interactive: true, fields: ["lower", "upper", "function"], 
          template: "\\int_{{{lower}}}^{{{upper}}} {{{function}}} dx" },
        { label: "∬ Double Integral", interactive: true, fields: ["region", "function", "integration variable"], 
          template: "\\iint_{{{region}}} {{function}} d{{integration variable}}" },
        { label: "∮ Contour Integral", interactive: true, fields: ["region", "function", "integration variable"], 
          template: "\\oint_{{{region}}} {{function}} d{{integration variable}}" },
        { label: "∂ Partial Derivative", interactive: true, fields: ["function", "variable"], 
          template: "\\frac{\\partial {{function}}}{\\partial {{variable}}}" },
        { label: "∇ Gradient", interactive: true, fields: ["function"], 
          template: "\\nabla {{function}}" },
        { label: "lim Limit", interactive: true, fields: ["limit variable", "limit", "function"], 
          template: "\\lim_{{{limit variable}} \\to {{limit}}} {{function}}" },
      ]
    },
    {
      name: "Algebra",
      items: [
        { label: "Σ Summation", interactive: true, fields: ["index", "start", "end", "expression"], template: "\\sum_{{{index}}={{{start}}}}^{{{end}}} {{{expression}}}" },
        { label: "∏ Product", interactive: true, fields: ["index", "start", "end", "expression"], template: "\\prod_{{{index}}={{{start}}}}^{{{end}}} {{{expression}}}" },
        { label: "± Plus/Minus", code: "\\pm" },
        { label: "≠ Not Equal", code: "\\neq" },
        { label: "≈ Approximately", code: "\\approx" },
        { label: "≤ Less or Equal", code: "\\leq" },
        { label: "≥ Greater or Equal", code: "\\geq" },
      ]
    },
    {
      name: "Greek Letters",
      items: [
        { label: "α Alpha", code: "\\alpha" },
        { label: "β Beta", code: "\\beta" },
        { label: "γ Gamma", code: "\\gamma" },
        { label: "δ Delta", code: "\\delta" },
        { label: "θ Theta", code: "\\theta" },
        { label: "λ Lambda", code: "\\lambda" },
        { label: "π Pi", code: "\\pi" },
        { label: "σ Sigma", code: "\\sigma" },
        { label: "Σ Capital Sigma", code: "\\Sigma" },
        { label: "Ω Omega", code: "\\Omega" },
      ]
    },
    {
      name: "Sets & Logic",
      items: [
        { label: "∈ Element of", code: "\\in" },
        { label: "∉ Not Element", code: "\\notin" },
        { label: "⊂ Subset", code: "\\subset" },
        { label: "∪ Union", code: "\\cup" },
        { label: "∩ Intersection", code: "\\cap" },
        { label: "∅ Empty Set", code: "\\emptyset" },
        { label: "∀ For All", code: "\\forall" },
        { label: "∃ Exists", code: "\\exists" },
      ]
    },
    {
      name: "Matrices",
      items: [
        { label: "2×2 Matrix", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "\\begin{pmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{pmatrix}" },
        { label: "3×3 Matrix", interactive: true, fields: ["a11", "a12", "a13", "a21", "a22", "a23", "a31", "a32", "a33"], 
          template: "\\begin{pmatrix} {{a11}} & {{a12}} & {{a13}} \\\\ {{a21}} & {{a22}} & {{a23}} \\\\ {{a31}} & {{a32}} & {{a33}} \\end{pmatrix}" },
        { label: "Determinant", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "\\begin{vmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{vmatrix}" },
        { label: "Bracket Matrix", interactive: true, fields: ["a11", "a12", "a21", "a22"], 
          template: "\\begin{bmatrix} {{a11}} & {{a12}} \\\\ {{a21}} & {{a22}} \\end{bmatrix}" },
      ]
    }
  ];

  const containerStyle = {
    background: "white",
    borderRadius: "20px",
    boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
    display: "flex",
    minHeight: "80vh",
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
    overflowY: "auto",
  };
  const headerStyle = {
    fontSize: "2.5rem",
    fontWeight: "700",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text",
    marginBottom: "2rem",
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
  const categoryTitleStyle = { fontSize: "0.875rem", fontWeight: "600", color: "rgba(255, 255, 255, 0.95)", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 };
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
    resize: "vertical",
    minHeight: "200px",
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

  return (
    <div style={containerStyle}>
      <div style={sidebarStyle}>
        <h2 style={{ color: "white", fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>LaTeX Snippets</h2>
        {latexCategories.map((category, categoryIndex) => {
          const isOpen = openCategories[category.name];
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
                {category.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    style={snippetButtonStyle}
                    onClick={() => {
                      if (item.interactive) setActiveSnippet(item);
                      else insertSnippet(item.code);
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)"; e.currentTarget.style.transform = "translateX(4px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)"; e.currentTarget.style.transform = "translateX(0)"; }}
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
        <h1 style={headerStyle}>Easy LaTeX Editor</h1>

        <div style={{ marginBottom: "2rem" }}>
          <h2 style={sectionTitleStyle}>Editor</h2>
          <textarea
            ref={textareaRef}
            style={textareaStyle}
            placeholder="Type your LaTeX code here..."
            value={text}
            onChange={handleChange}
            onFocus={(e) => e.currentTarget.style.borderColor = "#667eea"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e2e8f0"}
          />
          <button
            style={clearButtonStyle}
            onClick={handleClear}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#e53e3e"; e.currentTarget.style.color = "white"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "white"; e.currentTarget.style.color = "#e53e3e"; }}
          >
            Clear
          </button>
        </div>

        <div>
          <h2 style={sectionTitleStyle}>Preview</h2>
          <Preview content={text} />
        </div>
      </div>

      {activeSnippet && (
        <SnippetModal
          snippet={activeSnippet}
          onInsert={insertSnippet}
          onClose={() => setActiveSnippet(null)}
        />
      )}
    </div>
  );
}

// Modal for interactive snippets
function SnippetModal({ snippet, onInsert, onClose }) {
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
  const renderPreviewString = () => {
    let code = snippet.template;
    Object.keys(values).forEach(k => {
      const val = values[k] || "\\color{red}{\\Box}";
      code = code.replaceAll(`{{${k}}}`, val);
      code = code.replaceAll(`{{{${k}}}}`, val);
    });
    return code;
  };

  const overlayStyle = {
    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
    background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000
  };
  const modalStyle = {
    background: "white", padding: "2rem", borderRadius: "12px", minWidth: "350px",
    boxShadow: "0 10px 40px rgba(0,0,0,0.3)"
  };
  const inputStyle = {
    width: "100%", marginBottom: "1rem", padding: "0.5rem 0.75rem", fontSize: "1rem",
    borderRadius: "6px", border: "1px solid #ccc"
  };
  const buttonStyle = { padding: "0.5rem 1rem", marginRight: "0.5rem", borderRadius: "6px", cursor: "pointer" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: "1rem" }}>{snippet.label}</h3>

        {snippet.fields.map(f => (
          <input
            key={f}
            style={inputStyle}
            placeholder={f}
            value={values[f]}
            onChange={e => handleChange(f, e.target.value)}
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




// Preview component
function Preview({ content }) {
  const previewRef = React.useRef();
  React.useEffect(() => {
    if (previewRef.current) {
      try { katex.render(content, previewRef.current, { throwOnError: false, displayMode: true }); }
      catch (e) { previewRef.current.textContent = e.message; }
    }
  }, [content]);
  return <div ref={previewRef} style={{ background: "#f7fafc", border: "2px solid #e2e8f0", borderRadius: "10px", padding: "2rem", minHeight: "120px", fontSize: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.3s ease" }}></div>;
}

ReactDOM.createRoot(document.getElementById("app")).render(<LatexEditor />);
