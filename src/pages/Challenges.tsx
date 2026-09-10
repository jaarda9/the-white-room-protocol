import { Navigate } from 'react-router-dom';

/**
 * Awakened Raid Challenges have been merged into the unified Feats, Trophies & Raid Challenges view (/achievements).
 * Redirecting with ?tab=challenges preserves direct links and bookmarks.
 */
export default function Challenges() {
  return <Navigate to="/achievements?tab=challenges" replace />;
}
