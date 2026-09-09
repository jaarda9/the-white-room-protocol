import { Navigate } from 'react-router-dom';

/**
 * Analytics page has been merged into the unified Hunter Dossier & Combat Analytics view (/profile).
 * Redirecting with ?tab=analytics preserves direct links and bookmarks.
 */
export default function Analytics() {
  return <Navigate to="/profile?tab=analytics" replace />;
}
