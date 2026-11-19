import { useState } from 'react';
import { Calculator } from 'lucide-react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';
import PageHeader from '../components/PageHeader';
import Alert from '../components/Alert';

export default function NpvCalculator() {
  const { token } = useAuth();
  const [flows, setFlows] = useState('-100000,30000,30000,30000,40000');
  const [rate, setRate] = useState('10');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function calculate(e) {
    e.preventDefault();
    setError('');
    try {
      const cashFlows = flows.split(',').map((x) => Number(x.trim()));
      const data = await apiRequest('/api/reports/npv', {
        method: 'POST',
        token,
        body: { cashFlows, discountRatePercent: Number(rate) },
      });
      setResult(data);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="NPV calculator"
        description="Separate from asset NBV. Enter cash flows (period 0..n) and discount rate %."
      />
      <Alert type="error">{error}</Alert>
      <form className="panel stack-form" onSubmit={calculate}>
        <label>
          Cash flows (comma-separated)
          <input value={flows} onChange={(e) => setFlows(e.target.value)} />
        </label>
        <label>
          Discount rate %
          <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <button className="btn btn-primary" type="submit">
          <Calculator size={16} aria-hidden="true" />
          Calculate NPV
        </button>
      </form>
      {result ? (
        <article className="panel npv-result">
          <p className="stat-label">Net present value</p>
          <p className="stat-value">{result.npv}</p>
          <p className="muted">{result.note}</p>
          <div className="table-wrap">
            <table className="table-responsive">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Cash flow</th>
                  <th>Present value</th>
                </tr>
              </thead>
              <tbody>
                {result.periods.map((p) => (
                  <tr key={p.period}>
                    <td data-label="Period">{p.period}</td>
                    <td data-label="Cash flow">{p.cashFlow}</td>
                    <td data-label="Present value">{p.presentValue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      ) : null}
    </div>
  );
}