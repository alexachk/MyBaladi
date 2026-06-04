import type { JobCard } from '../types/jobCard';
import { formatDate } from '../utils/formatDate';

export interface RecapEmailContent {
  subject: string;
  body: string;
}

/** Professional pre-filled email accompanying the recap PDF. */
export function buildRecapEmail(job: JobCard, senderName: string): RecapEmailContent {
  const ref = job.reference || 'Intervention';
  const client = job.clientName || 'Client';
  const dateLabel = job.finishedAt
    ? formatDate(job.finishedAt)
    : job.scheduledDate
      ? formatDate(job.scheduledDate)
      : '';

  const lines = [
    `Dear ${client},`,
    '',
    `Please find attached the intervention report for job ${ref}${dateLabel ? ` (${dateLabel})` : ''}.`,
    '',
    'The report summarises the work performed, parts used, and visit details for your records.',
    'Should you have any question regarding this intervention, feel free to reply to this email.',
    '',
    'Kind regards,',
    senderName || 'The MyBaladi team',
  ];

  return {
    subject: `Intervention report · ${ref}${client ? ` · ${client}` : ''}`,
    body: lines.join('\n'),
  };
}
