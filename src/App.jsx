import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

import onboardingMd from '../ONBOARDING.md?raw'

// oneDark comment tokens are hsl(220,10%,40%) ≈ #5C6370 — too dark against
// our #111827 background. Override just comment/prolog/cdata to a readable
// muted gray (#9CA3AF) while leaving all other token colors untouched.
const codeTheme = {
  ...oneDark,
  'comment':  { color: '#9CA3AF', fontStyle: 'italic' },
  'prolog':   { color: '#9CA3AF' },
  'cdata':    { color: '#9CA3AF' },
}

// ─── READING ORDER — the 16 canonical files (section 6) ──────────────────────
const READING_ORDER = [
  { id: 'ro-1',  file: 'backend/config/schema.sql',                      why: 'Understand all database tables and relationships first' },
  { id: 'ro-2',  file: 'backend/config/db.js',                           why: 'See how Supabase clients are created and what env vars are needed' },
  { id: 'ro-3',  file: 'backend/server.js',                              why: 'The app entry point — all routes mounted and middleware applied' },
  { id: 'ro-4',  file: 'backend/middleware/auth.js',                     why: 'Understand protect / optionalAuth / adminOnly before reading controllers' },
  { id: 'ro-5',  file: 'backend/utils/jwt.js + utils/response.js',       why: 'Tiny helpers used everywhere' },
  { id: 'ro-6',  file: 'backend/models/User.js',                         why: 'See the pattern: model = async functions calling supabaseAdmin' },
  { id: 'ro-7',  file: 'backend/controllers/authController.js',          why: 'First complete request/response cycle to understand' },
  { id: 'ro-8',  file: 'backend/models/Project.js',                      why: 'Most complex model; relational queries + virtuals' },
  { id: 'ro-9',  file: 'backend/controllers/paymentController.js',       why: 'Razorpay order creation + signature verification logic' },
  { id: 'ro-10', file: 'backend/controllers/aiController.js',            why: 'Gemini proxy + all 5 prompt templates' },
  { id: 'ro-11', file: 'frontend/src/services/api.js',                   why: 'All frontend API calls; Axios setup and interceptors' },
  { id: 'ro-12', file: 'frontend/src/context/AuthContext.jsx',           why: 'Global auth state; understand before reading any page' },
  { id: 'ro-13', file: 'frontend/src/App.jsx',                           why: 'All routes, PrivateRoute guard, admin subtree, layout structure' },
  { id: 'ro-14', file: 'frontend/src/pages/ProjectDetailPage.jsx',       why: 'Most complex page: fetches project, runs Razorpay, shows comments' },
  { id: 'ro-15', file: 'frontend/src/pages/AIAssistantPage.jsx',         why: 'AI tool UI + "Apply to Campaign" sessionStorage handoff' },
  { id: 'ro-16', file: 'frontend/src/admin/ (folder)',                   why: 'Admin section has its own layout and role guard (AdminRoute.jsx)' },
]

const TOTAL = READING_ORDER.length
const LS_KEY = 'milestofund_checklist_v1'

// ─── UTILITIES ────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
}

// Extract headings, skipping lines inside fenced code blocks
function extractHeadings(markdown) {
  const lines = markdown.split('\n')
  const headings = []
  let inFence = false
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue }
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

// ─── CHECKLIST STATE (localStorage) ──────────────────────────────────────────
function loadChecked() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    return raw ? new Set(JSON.parse(raw)) : new Set()
  } catch { return new Set() }
}

function saveChecked(set) {
  try { localStorage.setItem(LS_KEY, JSON.stringify([...set])) } catch {}
}

// ─── CUSTOM MARKDOWN COMPONENTS ───────────────────────────────────────────────
// We intercept h2 matching "New Developer Reading Order" and render our
// interactive checklist instead of a plain markdown table.

function buildComponents(checkedIds, onToggle) {
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

  const checkedCount = checkedIds.size
  const pct = Math.round((checkedCount / TOTAL) * 100)

  return {
    h1: makeHeading('h1'),
    h2: makeHeading('h2'),
    h3: makeHeading('h3'),
    h4: makeHeading('h4'),

    // Wrap tables in scrollable div
    table({ children, ...props }) {
      // Detect if this is the Reading Order table — it has 3 columns: #, File, Why
      // We intercept it by rendering our checklist instead via a sibling flag set
      // in the h2 renderer. Instead, we do it structurally here by checking thead.
      return (
        <div className="table-wrapper">
          <table {...props}>{children}</table>
        </div>
      )
    },

    // Syntax-highlighted code blocks.
    // react-markdown v8 removed the `inline` prop; we distinguish inline vs block
    // by whether the element has a language class OR contains a newline.
    code({ node, className, children, ...props }) {
      const isBlock = node?.position
        ? (!!className || String(children).includes('\n'))
        : !!className

      if (!isBlock) {
        // True inline code — plain <code> picked up by the inline-code CSS rule.
        return <code className={className} {...props}>{children}</code>
      }

      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '')

      return (
        <div className="code-block-wrapper">
          {lang && <span className="code-lang-label">{lang}</span>}
          <SyntaxHighlighter
            style={codeTheme}
            language={lang || 'plaintext'}
            PreTag="div"
            customStyle={{
              margin: 0,
              borderRadius: '6px',
              fontSize: '13px',
              // colour lives here as an inline style so it has maximum specificity
              // and acts as the base for plain/untokenized text nodes
              color: '#D1D5DB',
              background: '#111827',
              border: '1px solid #1F2937',
              padding: '18px 16px',
            }}
            // Preserve the className on <code> so the inline-code CSS rule
            // (.prose code:not([class*="language-"])) never matches it, and
            // include the base text colour so <code> inherits it explicitly.
            codeTagProps={{
              className: lang ? `language-${lang}` : 'language-plaintext',
              style: {
                fontFamily: "'IBM Plex Mono', monospace",
                color: 'inherit',
                background: 'none',
              },
            }}
            {...(lang ? props : {})}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      )
    },
  }
}

// ─── CHECKLIST COMPONENT (replaces section 6 table) ──────────────────────────
function ReadingOrderChecklist({ checkedIds, onToggle }) {
  const checked = checkedIds.size
  const pct = Math.round((checked / TOTAL) * 100)

  return (
    <div>
      <p className="checklist-intro">
        Check off each file as you read it. Progress is saved automatically.
      </p>
      <div className="checklist-progress-bar">
        <div className="checklist-progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <table className="checklist-table">
        <thead>
          <tr>
            <th className="cl-num">#</th>
            <th className="cl-check" />
            <th>File</th>
            <th>Why read it</th>
          </tr>
        </thead>
        <tbody>
          {READING_ORDER.map((item, i) => {
            const isChecked = checkedIds.has(item.id)
            return (
              <tr
                key={item.id}
                className={isChecked ? 'checked' : ''}
                onClick={() => onToggle(item.id)}
              >
                <td className="cl-num">{i + 1}</td>
                <td className="cl-check">
                  <input
                    type="checkbox"
                    className="cl-checkbox"
                    checked={isChecked}
                    onChange={() => onToggle(item.id)}
                    onClick={e => e.stopPropagation()}
                  />
                </td>
                <td className={`cl-file${isChecked ? ' checked-text' : ''}`}>
                  {item.file}
                </td>
                <td className="cl-why">{item.why}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── MARKDOWN SPLITTER ────────────────────────────────────────────────────────
// Split the document at the "## 6. New Developer Reading Order" heading so we
// can inject the interactive checklist in place of the static markdown table.
const SPLIT_MARKER = '## 6. New Developer Reading Order'

function splitMarkdown(md) {
  const idx = md.indexOf(SPLIT_MARKER)
  if (idx === -1) return { before: md, sectionTitle: '', after: '' }

  // Find the next h2 after the split point (to know where section 6 ends)
  const afterSplit = md.slice(idx)
  // everything in section 6 until the next ## heading (or end of doc)
  const nextH2 = afterSplit.slice(SPLIT_MARKER.length).search(/\n## /)
  const sectionEnd = nextH2 === -1
    ? md.length
    : idx + SPLIT_MARKER.length + nextH2

  return {
    before: md.slice(0, idx),
    sectionTitle: SPLIT_MARKER,
    sectionRest: md.slice(idx + SPLIT_MARKER.length, sectionEnd),
    after: md.slice(sectionEnd),
  }
}

const MD_PARTS = splitMarkdown(onboardingMd)

// ─── SIDEBAR ──────────────────────────────────────────────────────────────────
// Build section-level completion data from the checklist.
// We associate section "6. New Developer Reading Order" with all 16 checklist items.
// Other sections have no checklist items, so they show no dot.
function Sidebar({ headings, activeId, checkedIds }) {
  const scrollTo = (id) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Map h2 headings to checklist counts
  // Only section 6 (reading order) has items
  const sectionProgress = useMemo(() => {
    const map = {}
    headings.forEach(h => {
      if (h.level === 2) {
        if (h.text.includes('New Developer Reading Order') || h.text.includes('6.')) {
          map[h.id] = { total: TOTAL, checked: checkedIds.size }
        }
      }
    })
    return map
  }, [headings, checkedIds])

  return (
    <nav className="sidebar" aria-label="Table of contents">
      <p className="sidebar-section-label">On this page</p>
      <ul className="toc-list">
        {headings.map((h) => {
          const prog = h.level === 2 ? sectionProgress[h.id] : undefined
          const isDone = prog ? prog.checked === prog.total && prog.total > 0 : false
          const isPartial = prog ? prog.checked > 0 && !isDone : false

          return (
            <li
              key={h.id}
              className={`toc-item level-${h.level}${activeId === h.id ? ' active' : ''}`}
            >
              <button className="toc-item-btn" onClick={() => scrollTo(h.id)} title={h.text}>
                {prog && (
                  <span className={`rail-dot${isDone ? ' done' : isPartial ? ' partial' : ''}`} />
                )}
                <span style={{ flex: 1 }}>{h.text}</span>
                {prog && (
                  <span className={`rail-frac${isDone ? ' done' : ''}`}>
                    {prog.checked}/{prog.total}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

// ─── TIME-SAVED STAT BLOCK ────────────────────────────────────────────────────
function StatBlock({ checkedIds }) {
  const checked = checkedIds.size
  const pct = Math.round((checked / TOTAL) * 100)
  return (
    <div className="stat-block">
      <div className="stat-item">
        <span className="stat-value">6–8 hrs</span>
        <span className="stat-label">typical manual onboarding</span>
      </div>
      <span className="stat-arrow">→</span>
      <div className="stat-item">
        <span className="stat-value accent">~30 min</span>
        <span className="stat-label">with this guide</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className="stat-value">{TOTAL} files</span>
        <span className="stat-label">in the reading order</span>
      </div>
      <div className="stat-divider" />
      <div className="stat-item">
        <span className={`stat-value${checked > 0 ? ' accent' : ''}`}>
          {checked} / {TOTAL}
        </span>
        <span className="stat-label">reviewed · {pct}% onboarded</span>
      </div>
    </div>
  )
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const headings = useMemo(() => extractHeadings(onboardingMd), [])

  const [activeId, setActiveId]   = useState('')
  const [checkedIds, setCheckedIds] = useState(loadChecked)
  const observerRef = useRef(null)

  const checked = checkedIds.size
  const pct     = Math.round((checked / TOTAL) * 100)

  // Persist checklist to localStorage
  useEffect(() => { saveChecked(checkedIds) }, [checkedIds])

  const toggle = useCallback((id) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  // IntersectionObserver for active TOC highlight
  const onIntersect = useCallback((entries) => {
    const visible = entries
      .filter(e => e.isIntersecting)
      .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
    if (visible.length > 0) setActiveId(visible[0].target.id)
  }, [])

  useEffect(() => {
    const els = document.querySelectorAll('.prose h1, .prose h2, .prose h3, .checklist-section-anchor')
    observerRef.current = new IntersectionObserver(onIntersect, {
      rootMargin: '-52px 0px -60% 0px',
      threshold: 0,
    })
    els.forEach(el => observerRef.current.observe(el))
    return () => observerRef.current?.disconnect()
  }, [onIntersect])

  const components = useMemo(() => buildComponents(checkedIds, toggle), [checkedIds, toggle])

  return (
    <div className="app-layout">

      {/* ── Fixed header ── */}
      <header className="header">
        <div className="header-wordmark">
          <span className="header-wordmark-name">MilestoFund</span>
          <span className="header-wordmark-label">Developer Onboarding</span>
        </div>
        <div className="header-divider" />
        <span className="header-progress-pill">
          <strong>{checked}</strong> of {TOTAL} files reviewed
          {checked > 0 && <> · <strong>{pct}%</strong> onboarded</>}
        </span>
      </header>

      {/* ── Progress stripe ── */}
      <div className="progress-stripe">
        <div className="progress-stripe-fill" style={{ width: `${pct}%` }} />
      </div>

      {/* ── Sidebar ── */}
      <Sidebar headings={headings} activeId={activeId} checkedIds={checkedIds} />

      {/* ── Main content ── */}
      <main className="main-content">

        {/* Time-saved stat block — above the paper panel */}
        <StatBlock checkedIds={checkedIds} />

        {/* Paper reading surface */}
        <div className="paper-panel">
          <article className="prose">

            {/* Part 1: everything before section 6 */}
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
              {MD_PARTS.before}
            </ReactMarkdown>

            {/* Section 6 heading */}
            <h2 id={slugify('6. New Developer Reading Order')}>
              6. New Developer Reading Order
            </h2>

            {/* Interactive checklist replaces the static table */}
            <ReadingOrderChecklist checkedIds={checkedIds} onToggle={toggle} />

            {/* Part 3: everything after section 6 (Quick Start etc.) */}
            {MD_PARTS.after && (
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
                {MD_PARTS.after}
              </ReactMarkdown>
            )}

          </article>
        </div>
      </main>

    </div>
  )
}
