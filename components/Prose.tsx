function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}

/**
 * Lightweight prose renderer. Splits on blank lines into paragraphs and
 * renders `**bold**` runs. Not a real markdown parser; we only need what the
 * personas actually emit.
 */
export function Prose({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean)
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className={i > 0 ? "mt-3" : ""}>
          {renderInline(block)}
        </p>
      ))}
    </>
  )
}
