import { useEffect, useState } from 'react';
import { FileUp } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';
import LoadingBlock from '../components/LoadingBlock';

export default function InvoiceIntake() {
  const { token, isAdmin } = useAuth();
  const [status, setStatus] = useState(null);
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({
    assetCode: '',
    name: '',
    category: 'General',
    location: 'Intake',
    vendor: '',
    serialNumber: '',
    purchaseDate: '',
    purchaseCost: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [loading, setLoading] = useState(false);

  const step = success ? 3 : draftReady ? 2 : 1;

  useEffect(() => {
    apiRequest('/api/invoice/status', { token })
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, [token]);

  async function extract(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a PDF or image first');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const data = await apiRequest('/api/invoice/extract', {
        method: 'POST',
        token,
        formData: fd,
      });
      setForm((f) => ({
        ...f,
        vendor: data.suggestion.vendor || '',
        purchaseDate: data.suggestion.invoiceDate || '',
        name: data.suggestion.description || f.name,
        serialNumber: data.suggestion.serialNumber || '',
        purchaseCost: data.suggestion.purchaseCost ?? '',
      }));
      setDraftReady(true);
      setSuccess('Review extracted values, edit if needed, then confirm to create an asset.');
    } catch (err) {
      setError(err.message);
      if (err.data?.suggestion) {
        setForm((f) => ({ ...f, ...mapSuggestion(err.data.suggestion) }));
        setDraftReady(true);
      }
    } finally {
      setLoading(false);
    }
  }

  function mapSuggestion(s) {
    return {
      vendor: s.vendor || '',
      purchaseDate: s.invoiceDate || '',
      name: s.description || '',
      serialNumber: s.serialNumber || '',
      purchaseCost: s.purchaseCost ?? '',
    };
  }

  async function confirmCreate(e) {
    e.preventDefault();
    if (!isAdmin) {
      setError('Only Admins can create assets from invoice intake');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/api/invoice/confirm-asset', {
        method: 'POST',
        token,
        body: { ...form, confirmed: true },
      });
      setSuccess(`Asset ${data.assetCode} created`);
      setDraftReady(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Invoice → asset intake"
        description="Upload invoice PDF/image. Gemini suggests fields; you must confirm before saving."
      />

      <nav className="stepper" aria-label="Intake steps">
        <span className={`step-pill${step === 1 ? ' active' : ''}`}>1. Upload</span>
        <span className={`step-pill${step === 2 ? ' active' : ''}`}>2. Review</span>
        <span className={`step-pill${step === 3 ? ' active' : ''}`}>3. Confirm</span>
      </nav>

      {status ? (
        <Alert type={status.geminiConfigured ? 'success' : 'error'}>{status.message}</Alert>
      ) : null}
      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>
      {loading ? <LoadingBlock label="Working on invoice…" /> : null}

      <section className="form-grid split">
        <article className="panel form-panel">
          <h2>Upload</h2>
          <form className="stack-form" onSubmit={extract}>
            <label>
              Invoice file (PDF/JPEG/PNG/WebP, max 8MB)
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </label>
            <button className="btn btn-secondary" type="submit" disabled={loading}>
              <FileUp size={16} aria-hidden="true" />
              {loading ? 'Extracting…' : 'Extract with Gemini / continue manually'}
            </button>
          </form>
        </article>

        <article className="panel form-panel">
          <h2>Review &amp; confirm</h2>
          {!draftReady ? (
            <p className="muted">Extract or fill manually after upload attempt.</p>
          ) : (
            <form className="stack-form" onSubmit={confirmCreate}>
              {[
                'assetCode',
                'name',
                'category',
                'location',
                'vendor',
                'serialNumber',
                'purchaseDate',
                'purchaseCost',
              ].map((k) => (
                <label key={k}>
                  {k}
                  <input
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    required={['assetCode', 'name'].includes(k)}
                  />
                </label>
              ))}
              <button className="btn btn-primary" type="submit" disabled={loading || !isAdmin}>
                Confirm create asset
              </button>
              {!isAdmin ? <p className="muted">Admin role required to save.</p> : null}
            </form>
          )}
          {!draftReady ? (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setDraftReady(true)}
            >
              Enter manually without Gemini
            </button>
          ) : null}
        </article>
      </section>
    </div>
  );
}