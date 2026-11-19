import { useState } from 'react';
import { apiRequest } from '../api';
import { useAuth } from '../auth';

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
      <header className="page-header">
        <div>
          <h1>NPV calculator</h1>
          <p className="muted">
            Separate from asset NBV. Enter cash flows (period 0..n) and discount rate %.
          </p>
        </div>
      </header>
      {error ? <p className="error">{error}</p> : null}
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
          Calculate NPV
        </button>
      </form>
      {result ? (
        <article className="panel">
          <p className="ok">NPV = {result.npv}</p>
          <p className="muted">{result.note}</p>
          <div className="table-wrap">
            <table>
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
                    <td>{p.period}</td>
                    <td>{p.cashFlow}</td>
                    <td>{p.presentValue}</td>
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
