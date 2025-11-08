const app = document.getElementById("app");

function Preview({ content }) {
  return (
    <div style={{ border: "1px solid gray", padding: "10px", marginTop: "10px" }}>
      <h3>Preview</h3>
      <pre>{content}</pre>
    </div>
  );
}

function LatexEditor() {
  const [text, setText] = React.useState("");

  const handleChange = (e) => {
    setText(e.target.value);
  };

  const handleClear = () => {
    setText("");
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px" }}>
      <h2>Simple LaTeX Editor</h2>
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

const root = ReactDOM.createRoot(app);
root.render(<LatexEditor />);
