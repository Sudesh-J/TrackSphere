export default function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div className="page-header-text">
        <h1>{title}</h1>
        {description ? <p className="muted page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="header-actions">{actions}</div> : null}
    </header>
  );
}
