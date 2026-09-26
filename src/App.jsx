import { useState, useEffect, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Import the markdown file as a raw string
import onboardingMd from '../ONBOARDING.md?raw'

// ─── Utility: slugify heading text to an anchor id ───────────────────────────
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

// ─── Extract TOC headings from markdown source ────────────────────────────────
// Skips any lines that appear inside a fenced code block (``` ... ```)
function extractHeadings(markdown) {
  const lines = markdown.split('\n')
  const headings = []
  let inFence = false
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = line.match(/^(#{1,3})\s+(.+)/)
    if (match) {
      const level = match[1].length
      const text = match[2].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim()
      headings.push({ level, text, id: slugify(text) })
    }
  }
  return headings
}

// ─── Custom renderers for ReactMarkdown ──────────────────────────────────────
function buildComponents() {
  // Heading factory — injects slug id for scroll targeting
  const makeHeading = (Tag) =>
    function HeadingRenderer({ children, ...props }) {
      const text = typeof children === 'string'
        ? children
        : Array.isArray(children)
          ? children.map(c => (typeof c === 'string' ? c : c?.props?.children ?? '')).join('')
          : ''
      const id = slugify(text)
      return <Tag id={id} {...props}>{children}</Tag>
    }

  return {
    h1: makeHeading('h1'),
    h2: makeHeading('h2'),
    h3: makeHeading('h3'),
    h4: makeHeading('h4'),

    // Wrap tables in a scrollable div
    table({ children, ...props }) {
      return (
        <div className="table-wrapper">
          <table {...props}>{children}</table>
        </div>
      )
    },

    // Syntax-highlighted code blocks with language label
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      if (!inline && lang) {
        return (
          <div className="code-block-wrapper">
            {lang && <span className="code-lang-label">{lang}</span>}
            <SyntaxHighlighter
              style={oneDark}
              language={lang}
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '8px',
                fontSize: '13px',
                background: '#0d1117',
                border: '1px solid #2e3250',
                padding: '20px 16px',
              }}
              codeTagProps={{ style: { fontFamily: "'JetBrains Mono', monospace" } }}
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        )
      }

      // Inline code or fenced block without a language
      if (!inline) {
        return (
          <div className="code-block-wrapper">
            <SyntaxHighlighter
              style={oneDark}
              language="text"
              PreTag="div"
              customStyle={{
                margin: 0,
                borderRadius: '8px',
                fontSize: '13px',
                background: '#0d1117',
                border: '1px solid #2e3250',
                padding: '20px 16px',
              }}
              codeTagProps={{ style: { fontFamily: "'JetBrains Mono', monospace" } }}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        )
      }

      return <code className={className} {...props}>{children}</code>
    },
  }
}

const COMPONENTS = buildComponents()

// ─── Sidebar TOC ─────────────────────────────────────────────────────────────
function Sidebar({ headings, activeId }) {
  const scrollToHeading = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav className="sidebar" aria-label="Table of contents">
      <p className="sidebar-heading">On this page</p>
      <ul className="toc-list">
        {headings.map((h) => (
          <li
            key={h.id}
            className={`toc-item level-${h.level}${activeId === h.id ? ' active' : ''}`}
          >
            <button onClick={() => scrollToHeading(h.id)} title={h.text}>
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const headings = extractHeadings(onboardingMd)
  const [activeId, setActiveId] = useState('')
  const observerRef = useRef(null)

  // IntersectionObserver — track which heading is in view
  const onIntersect = useCallback((entries) => {
    // Find the topmost visible heading
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    if (visible.length > 0) {
      setActiveId(visible[0].target.id)
    }
  }, [])

  useEffect(() => {
    const headingEls = document.querySelectorAll('.prose h1, .prose h2, .prose h3')
    observerRef.current = new IntersectionObserver(onIntersect, {
      rootMargin: '-60px 0px -60% 0px',
      threshold: 0,
    })
    headingEls.forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [onIntersect])

  return (
    <div className="app-layout">
      {/* ── Top bar ── */}
      <header className="header">
        <div className="header-logo">M</div>
        <span className="header-title">MilestoFund</span>
        <span className="header-badge">Developer Onboarding</span>
      </header>

      {/* ── Sidebar TOC ── */}
      <Sidebar headings={headings} activeId={activeId} />

      {/* ── Main content ── */}
      <main className="main-content">
        <article className="prose">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={COMPONENTS}
          >
            {onboardingMd}
          </ReactMarkdown>
        </article>
      </main>
    </div>
  )
}
