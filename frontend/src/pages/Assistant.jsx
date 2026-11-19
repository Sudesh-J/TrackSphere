import PageHeader from '../components/PageHeader';
import AssistantPanel from '../components/AssistantPanel';

export default function Assistant() {
  return (
    <div className="page">
      <PageHeader
        title="Gemini assistant"
        description="Find assets, summarize inventory, explain the app. Data changes require confirmation."
      />
      <article className="panel assistant-page-card">
        <AssistantPanel />
      </article>
    </div>
  );
}
