import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import StatusBadge from '../components/StatusBadge';

export default function ScanHandover() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [preview, setPreview] = useState(null);
  const scannerRef = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  async function startCamera() {
    setError('');
    try {
      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;
      setScanning(true);
      started.current = true;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 8, qrbox: { width: 240, height: 240 } },
        async (decoded) => {
          await scanner.stop().catch(() => {});
          setScanning(false);
          handleDecoded(decoded);
        }
      );
    } catch (err) {
      setScanning(false);
      setError(
        err.message ||
          'Camera unavailable. Use manual asset code entry, or open a QR URL from the phone camera.'
      );
    }
  }

  function handleDecoded(text) {
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('handover');
      if (idx >= 0 && parts[idx + 1]) {
        navigate(`/handover/${parts[idx + 1]}`);
        return;
      }
    } catch {
      /* not a URL — maybe raw token */
    }
    if (/^[0-9a-f-]{36}$/i.test(text.trim())) {
      navigate(`/handover/${text.trim()}`);
      return;
    }
    setError('Unrecognized QR content. Expected a TrackSphere handover URL.');
  }

  async function lookupManual(e) {
    e.preventDefault();
    setError('');
    setPreview(null);
    try {
      const data = await apiRequest(
        `/api/assets?search=${encodeURIComponent(manualCode.trim())}`,
        { token }
      );
      const match = data.assets.find(
        (a) => a.assetCode.toLowerCase() === manualCode.trim().toLowerCase()
      );
      if (!match) {
        setError('No asset found for that code');
        return;
      }
      setPreview(match);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Scan / handover</h1>
          <p className="muted">
            QR-based asset handover (replaces simulated RFID as the main tracking flow)
          </p>
        </div>
      </header>

      {error ? <p className="error">{error}</p> : null}

      <section className="split">
        <article className="panel">
          <h2>Phone camera scan</h2>
          <div id="qr-reader" className="qr-reader" />
          {!scanning ? (
            <button type="button" className="btn btn-primary" onClick={startCamera}>
              Start camera
            </button>
          ) : (
            <p className="muted">Point at an asset QR code…</p>
          )}
          <p className="hint">
            Tip: phone camera apps can also open the QR URL directly → login → handover page.
          </p>
        </article>

        <article className="panel form-panel">
          <h2>Manual asset code</h2>
          <form className="stack-form" onSubmit={lookupManual}>
            <label>
              Asset code
              <input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. AST-1002"
                required
              />
            </label>
            <button className="btn btn-secondary" type="submit">
              Look up
            </button>
          </form>
          {preview ? (
            <div className="result-box">
              <p>
                <strong>{preview.assetCode}</strong> — {preview.name}
              </p>
              <p>
                Status: <StatusBadge status={preview.status} />
              </p>
              <p>Assignee: {preview.currentAssignee || '—'}</p>
              <Link className="btn btn-primary" to={`/handover/${preview.qrToken}`}>
                Open handover
              </Link>
            </div>
          ) : null}
        </article>
      </section>
    </div>
  );
}
