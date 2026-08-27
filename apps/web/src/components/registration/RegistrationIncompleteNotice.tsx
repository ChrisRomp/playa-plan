interface RegistrationIncompleteNoticeProps {
  completionAvailable: boolean;
}

export function RegistrationIncompleteNotice({
  completionAvailable,
}: RegistrationIncompleteNoticeProps) {
  const message = completionAvailable
    ? 'Please complete your registration.'
    : 'Registration is closed.';

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <p className="font-semibold">Registration incomplete — action required</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
    </div>
  );
}
