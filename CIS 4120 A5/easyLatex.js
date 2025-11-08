function LatexEditor() {
  const [text, setText] = React.useState("");

  const handleChange = (e) => setText(e.target.value);
  const handleClear = () => setText("");

  const insertSnippet = (snippet) => {
    setText((prev) => prev + " " + snippet);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>Easy LaTeXs</h2>

      <div style={{ marginBottom: "10px" }}>
        <button onClick={() => insertSnippet("\\sum_{i=1}^{n} i^2")}>Σ Sum</button>
        <button onClick={() => insertSnippet("\\frac{a}{b}")}>Fraction</button>
        <button onClick={() => insertSnippet("\\sqrt{x}")}>√ Root</button>
        <button onClick={() => insertSnippet("\\int_{0}^{1} x^2 dx")}>∫ Integral</button>
      </div>

      <textarea
        rows="10"
        cols="60"
        placeholder="Type your LaTeX code here..."
        value={text}
        onChange={handleChange}
      />
      <br />
      <button onClick={handleClear}>Clear</button>

      <Preview content={text} />
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

  return (
    <div
      style={{
        border: "1px solid gray",
        padding: "10px",
        marginTop: "10px",
        minHeight: "50px",
      }}
      ref={previewRef}
    ></div>
  );
}

ReactDOM.createRoot(document.getElementById("app")).render(<LatexEditor />);
