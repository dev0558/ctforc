const STATUS_LABELS = {
  queued: 'Queued',
  researching: 'Researching',
  pending_spec_review: 'Spec Review',
  spec_approved: 'Spec Approved',
  building: 'Building',
  pending_build_review: 'Build Review',
  ready: 'Ready',
  failed: 'Failed',
  rejected: 'Rejected',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`badge badge-${status}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}
