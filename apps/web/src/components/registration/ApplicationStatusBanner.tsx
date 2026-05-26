interface ApplicationStatusBannerProps {
  status: string;
  decisionMessage?: string | null;
  submittedAt?: string;
}

interface BannerState {
  accentClassName: string;
  title: string;
  message: string;
}

function getBannerState(status: string): BannerState {
  switch (status) {
    case 'APPLICATION_APPROVED':
      return {
        accentClassName: 'border-green-200 bg-green-50 text-green-900',
        title: 'Application approved',
        message:
          'Your application has been approved! Please complete your registration below by selecting your jobs and paying camp dues.',
      };
    case 'APPLICATION_DECLINED':
      return {
        accentClassName: 'border-orange-200 bg-orange-50 text-orange-900',
        title: 'Application not approved',
        message:
          'Your application was not approved. If you have questions, please contact camp leadership.',
      };
    case 'APPLICATION_SUBMITTED':
    default:
      return {
        accentClassName: 'border-blue-200 bg-blue-50 text-blue-900',
        title: 'Application pending review',
        message:
          "Your application has been submitted and is pending review. We'll notify you by email once a decision is made.",
      };
  }
}

export function ApplicationStatusBanner({
  status,
  decisionMessage,
  submittedAt,
}: ApplicationStatusBannerProps) {
  const bannerState = getBannerState(status);

  return (
    <div className={`mb-6 rounded-xl border px-5 py-4 shadow-sm ${bannerState.accentClassName}`}>
      <div className="flex flex-col gap-2">
        <div>
          <h2 className="text-lg font-semibold">{bannerState.title}</h2>
          <p className="mt-1 text-sm leading-6">{bannerState.message}</p>
        </div>

        {submittedAt && (
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">
            Submitted {new Date(submittedAt).toLocaleString()}
          </p>
        )}

        {status === 'APPLICATION_DECLINED' && decisionMessage && (
          <div className="rounded-lg border border-orange-300 bg-white/70 px-4 py-3 text-sm">
            <p className="font-medium">Reviewer message</p>
            <p className="mt-1 whitespace-pre-line">{decisionMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
