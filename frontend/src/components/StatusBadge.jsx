const LABELS = {
  available: 'Available',
  in_use: 'In use',
  maintenance: 'Maintenance',
  missing: 'Missing',
  retired: 'Retired',
  allocated: 'Allocated',
  returned: 'Returned',
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  online: 'Online',
  offline: 'Offline',
  degraded: 'Degraded',
  scrap: 'Scrap',
  sale: 'Sale',
  donate: 'Donate',
};

export default function StatusBadge({ status }) {
  const key = String(status || '').toLowerCase();
  return (
    <span className={`badge badge-${key}`}>
      {LABELS[key] || status}
    </span>
  );
}
