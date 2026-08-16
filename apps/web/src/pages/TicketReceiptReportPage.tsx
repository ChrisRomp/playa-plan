import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Download, FileSignature } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useConfig } from '../hooks/useConfig';
import { campingOptions, reports, TicketReceiptReportOptions } from '../lib/api';
import { PATHS } from '../routes';
import { CampingOption } from '../types';
import { downloadFile } from '../utils/downloadFile';

const ACKNOWLEDGEMENT_MAXIMUM_LINES = 10;

interface TicketReceiptFormState {
  readonly title: string;
  readonly acknowledgementText: string;
  readonly year: number;
  readonly campingOptionId: string;
  readonly additionalBlankRows: number;
}

/** Staff/admin form for generating ticket-receipt signature PDFs. */
export function TicketReceiptReportPage() {
  const { config, isLoading: configLoading } = useConfig();
  const [form, setForm] = useState<TicketReceiptFormState>({
    title: 'Ticket Receipt Report',
    acknowledgementText: '',
    year: config?.currentYear ?? new Date().getFullYear(),
    campingOptionId: '',
    additionalBlankRows: 0,
  });
  const [options, setOptions] = useState<CampingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadReportOptions = async (): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        const [settings, campingOptionData] = await Promise.all([
          reports.getTicketReceiptSettings(),
          campingOptions.getAll(true),
        ]);
        setOptions(campingOptionData);
        setForm(current => ({
          ...current,
          title: settings.title,
          acknowledgementText: settings.acknowledgementText,
        }));
      } catch (loadError) {
        console.error('Failed to load ticket receipt report options:', loadError);
        setError('Failed to load report options. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    void loadReportOptions();
  }, []);

  useEffect(() => {
    if (config?.currentYear) {
      setForm(current => ({
        ...current,
        year: config.currentYear,
      }));
    }
  }, [config?.currentYear]);

  const updateForm = <Key extends keyof TicketReceiptFormState>(
    key: Key,
    value: TicketReceiptFormState[Key]
  ): void => {
    setForm(current => ({ ...current, [key]: value }));
  };

  const validateForm = (): string | null => {
    if (!form.title.trim()) {
      return 'Report title is required.';
    }
    if (!form.acknowledgementText.trim()) {
      return 'Acknowledgement text is required.';
    }
    if (form.acknowledgementText.split(/\r\n|\r|\n/).length > ACKNOWLEDGEMENT_MAXIMUM_LINES) {
      return `Acknowledgement must be ${ACKNOWLEDGEMENT_MAXIMUM_LINES} lines or fewer.`;
    }
    if (
      !Number.isInteger(form.additionalBlankRows) ||
      form.additionalBlankRows < 0 ||
      form.additionalBlankRows > 50
    ) {
      return 'Additional blank rows must be a whole number from 0 through 50.';
    }
    return null;
  };

  const generateReport = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);
    try {
      const request: TicketReceiptReportOptions = {
        title: form.title.trim(),
        acknowledgementText: form.acknowledgementText.trim(),
        year: form.year,
        additionalBlankRows: form.additionalBlankRows,
        ...(form.campingOptionId ? { campingOptionId: form.campingOptionId } : {}),
      };
      const download = await reports.generateTicketReceipt(request);
      downloadFile(download.blob, download.filename);
      setSuccess('Report downloaded. The title and acknowledgement are now the shared defaults.');
    } catch (generationError) {
      console.error('Failed to generate ticket receipt report:', generationError);
      setError(reports.getReportErrorMessage(generationError));
    } finally {
      setGenerating(false);
    }
  };

  if (loading || configLoading) {
    return (
      <div className="container mx-auto flex justify-center px-4 py-16">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <Link
          to={PATHS.REPORTS}
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          <ArrowLeft size={18} />
          Back to Reports
        </Link>

        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-amber-100 p-3">
              <FileSignature className="text-amber-800" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Ticket Receipt Signature Form</h1>
              <p className="text-sm text-gray-600">
                Generate a landscape PDF for confirmed registrations.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          {success && (
            <div
              role="status"
              className="mb-5 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700"
            >
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={generateReport}>
            <div>
              <label
                htmlFor="report-title"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Report title
              </label>
              <input
                id="report-title"
                type="text"
                maxLength={100}
                value={form.title}
                onChange={event => updateForm('title', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <label
                htmlFor="acknowledgement-text"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Acknowledgement
              </label>
              <textarea
                id="acknowledgement-text"
                rows={4}
                maxLength={1000}
                required
                value={form.acknowledgementText}
                onChange={event => updateForm('acknowledgementText', event.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
              <p className="mt-1 text-xs text-gray-500">
                Up to {ACKNOWLEDGEMENT_MAXIMUM_LINES} lines. The title and acknowledgement become
                shared defaults after a successful download.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="registration-year"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Registration year
                </label>
                <input
                  id="registration-year"
                  type="number"
                  min={2000}
                  max={2100}
                  value={form.year}
                  onChange={event => updateForm('year', Number(event.target.value))}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                />
              </div>

              <div>
                <label
                  htmlFor="camping-option"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Camping option
                </label>
                <select
                  id="camping-option"
                  value={form.campingOptionId}
                  onChange={event => updateForm('campingOptionId', event.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
                >
                  <option value="">* All camping options</option>
                  {options.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                      {!option.enabled ? ' (disabled)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="additional-blank-rows"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Additional blank rows
              </label>
              <input
                id="additional-blank-rows"
                type="number"
                min={0}
                max={50}
                step={1}
                value={form.additionalBlankRows}
                onChange={event => updateForm('additionalBlankRows', Number(event.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:w-48"
              />
              <p className="mt-1 text-xs text-gray-500">
                Add up to 50 fill-in rows for manual registrations.
              </p>
            </div>

            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating ? <LoadingSpinner size="sm" /> : <Download size={18} />}
              {generating ? 'Generating…' : 'Generate PDF'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
