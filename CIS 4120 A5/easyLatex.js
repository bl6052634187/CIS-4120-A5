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

  const handleChange = (e) => setText(e.target.value);
  const handleClear = () => setText("");

  const insertSnippet = (snippet) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = text.substring(0, start);
    const textAfter = text.substring(end);

    // Add space before snippet if needed
    const prefix = (start > 0 && textBefore[textBefore.length - 1] !== ' ') ? ' ' : '';
    const newText = textBefore + prefix + snippet + textAfter;
    const newCursorPos = start + prefix.length + snippet.length;

    // Use native input to preserve undo stack
    textarea.focus();
    textarea.setSelectionRange(start, end);
    document.execCommand('insertText', false, prefix + snippet);

    // Update React state
    setText(newText);

    // Set cursor position after insertion
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
        { label: "⁄ Fraction", code: "\\frac{a}{b}" },
        { label: "√ Square Root", code: "\\sqrt{x}" },
        { label: "ⁿ√ Nth Root", code: "\\sqrt[n]{x}" },
        { label: "x² Superscript", code: "x^{2}" },
        { label: "x₂ Subscript", code: "x_{2}" },
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
        { label: "∫ Integral", code: "\\int_{a}^{b} f(x) dx" },
        { label: "∬ Double Integral", code: "\\iint_{D} f(x,y) dA" },
        { label: "∮ Contour Integral", code: "\\oint_{C} f(z) dz" },
        { label: "∂ Partial Derivative", code: "\\frac{\\partial f}{\\partial x}" },
        { label: "∇ Gradient", code: "\\nabla f" },
        { label: "lim Limit", code: "\\lim_{x \\to \\infty} f(x)" },
      ]
    },
    {
      name: "Algebra",
      items: [
        { label: "Σ Summation", code: "\\sum_{i=1}^{n} i^2" },
        { label: "∏ Product", code: "\\prod_{i=1}^{n} i" },
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
        { label: "2×2 Matrix", code: "\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}" },
        { label: "3×3 Matrix", code: "\\begin{pmatrix} a & b & c \\\\ d & e & f \\\\ g & h & i \\end{pmatrix}" },
        { label: "Determinant", code: "\\begin{vmatrix} a & b \\\\ c & d \\end{vmatrix}" },
        { label: "Bracket Matrix", code: "\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}" },
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

  const firstCategoryHeaderStyle = {
    ...categoryHeaderStyle,
    marginTop: "0",
  };

  const categoryTitleStyle = {
    fontSize: "0.875rem",
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.95)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: 0,
  };

  const chevronStyle = {
    fontSize: "0.75rem",
    color: "rgba(255, 255, 255, 0.9)",
    transition: "transform 0.3s ease",
  };

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
        <h2 style={{ color: "white", fontSize: "1.25rem", fontWeight: "600", marginBottom: "1.5rem" }}>
          LaTeX Snippets
        </h2>
        {latexCategories.map((category, categoryIndex) => {
          const isOpen = openCategories[category.name];
          return (
            <div key={category.name}>
              <div
                style={categoryIndex === 0 ? firstCategoryHeaderStyle : categoryHeaderStyle}
                onClick={() => toggleCategory(category.name)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                }}
              >
                <h3 style={categoryTitleStyle}>
                  {category.name}
                </h3>
                <span style={{
                  ...chevronStyle,
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)"
                }}>
                  ▶
                </span>
              </div>
              <div style={{
                ...categoryContentStyle,
                maxHeight: isOpen ? "2000px" : "0px",
                opacity: isOpen ? 1 : 0,
                marginTop: isOpen ? "0.5rem" : "0",
                marginBottom: isOpen ? "0.5rem" : "0"
              }}>
                {category.items.map((item, itemIndex) => (
                  <button
                    key={itemIndex}
                    style={snippetButtonStyle}
                    onClick={() => insertSnippet(item.code)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.25)";
                      e.currentTarget.style.transform = "translateX(4px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.15)";
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

        <div>
          <h2 style={sectionTitleStyle}>Preview</h2>
          <Preview content={text} />
        </div>
      </div>
    </div>
  );
}

function Preview({ content }) {
  const previewRef = React.useRef();

  React.useEffect(() => {
    if (previewRef.current) {
      try {
        katex.render(content, previewRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        previewRef.current.textContent = e.message;
      }
    }
  }, [content]);

  const previewStyle = {
    background: "#f7fafc",
    border: "2px solid #e2e8f0",
    borderRadius: "10px",
    padding: "2rem",
    minHeight: "120px",
    fontSize: "1.25rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.3s ease",
  };

  return (
    <div style={previewStyle} ref={previewRef}></div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<LatexEditor />);
