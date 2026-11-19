export default function EmptyState({ title = 'Nothing here yet', description }) {
  return (
    <div className="empty-state">
      <p className="empty-title">{title}</p>
      {description ? <p className="muted">{description}</p> : null}
    </div>
  );
}
