import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import AssistantPanel from './AssistantPanel';

export default function AssistantDock() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (location.pathname === '/assistant') return null;

  return (
    <div className={`assistant-dock ${open ? 'is-open' : ''}`}>
      {open ? (
        <section
          id="assistant-dock-panel"
          className="assistant-dock-panel"
          role="dialog"
          aria-label="TrackSphere assistant"
          aria-modal="false"
        >
          <header className="assistant-dock-head">
            <div>
              <strong>Assistant</strong>
              <p className="muted small">Answers stay suggestions until you confirm a change.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </header>
          <AssistantPanel compact />
        </section>
      ) : null}
      <button
        type="button"
        className="assistant-fab"
        aria-expanded={open}
        aria-controls="assistant-dock-panel"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X size={22} /> : <Sparkles size={22} />}
        <span className="sr-only">{open ? 'Close assistant' : 'Open assistant'}</span>
      </button>
    </div>
  );
}
