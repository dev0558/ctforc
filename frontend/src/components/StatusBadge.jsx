const STATUS_LABELS = {
  queued: 'Queued',
  researching: 'Researching',
  architecting: 'Architecting',
  pending_spec_review: 'Spec Review',
  spec_approved: 'Spec Approved',
  building: 'Developing',
  developing: 'Developing',
  pending_build_review: 'Build Review',
  ready: 'Ready',
  failed: 'Failed',
  rejected: 'Rejected',
  reworking_spec: 'Reworking Spec',
  reworking_build: 'Reworking Build',
  rejected_final: 'Rejected (Final)',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
