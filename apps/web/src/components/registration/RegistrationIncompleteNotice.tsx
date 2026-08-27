interface RegistrationIncompleteNoticeProps {
  completionAvailable: boolean;
}

export function RegistrationIncompleteNotice({
  completionAvailable,
}: RegistrationIncompleteNoticeProps) {
  const message = completionAvailable
    ? 'Complete your work shifts, accept the camp terms, and arrange camp dues to finish registering.'
    : 'Your application is approved, but registration completion is not currently available. You still need to select work shifts, accept the camp terms, and arrange camp dues before your registration is complete.';

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <p className="font-semibold">Registration incomplete — action required</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
    </div>
  );
}
