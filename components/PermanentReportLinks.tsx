import { useState } from 'react';

interface PermanentReportLinksProps {
  pdfReportUrl?: string;
  htmlReportUrl?: string;
  pdfGeneratedAt?: Date;
  htmlGeneratedAt?: Date;
}

export default function PermanentReportLinks({
  pdfReportUrl,
  htmlReportUrl,
  pdfGeneratedAt,
  htmlGeneratedAt
}: PermanentReportLinksProps) {
  const [copiedPdf, setCopiedPdf] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const copyToClipboard = async (text: string, type: 'pdf' | 'html') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'pdf') {
        setCopiedPdf(true);
        setTimeout(() => setCopiedPdf(false), 2000);
      } else {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const formatDate = (date?: Date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!pdfReportUrl && !htmlReportUrl) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: '12px',
      padding: '1.5rem',
      marginBottom: '2rem',
      boxShadow: '0 4px 16px rgba(15, 23, 42, 0.08)'
    }}>
      <h3 style={{
        fontSize: '1.125rem',
        fontWeight: 700,
        color: '#1e293b',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M10 13a5 5 5 0 0 7.54.54l3-3a5 5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
          <path d="M14 11a5 5 5 0 0 -7.54-.54l-3 3a5 5 5 0 0 7.07 7.07l1.71-1.71"></path>
        </svg>
        Permanent Report Links
      </h3>
      
      <p style={{
        fontSize: '0.875rem',
        color: '#64748b',
        marginBottom: '1rem'
      }}>
        Share these permanent links with clients via email. Reports are stored in the cloud and will remain accessible.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {pdfReportUrl && (
          <div style={{
            backgroundColor: '#fff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                📄 PDF Report
              </span>
              {pdfGeneratedAt && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {formatDate(pdfGeneratedAt)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={pdfReportUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => copyToClipboard(pdfReportUrl, 'pdf')}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: copiedPdf ? '#10b981' : '#fff',
                  backgroundColor: copiedPdf ? '#d1fae5' : '#8230c9',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {copiedPdf ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}

        {htmlReportUrl && (
          <div style={{
            backgroundColor: '#fff',
            padding: '1rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                🌐 HTML Report
              </span>
              {htmlGeneratedAt && (
                <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  {formatDate(htmlGeneratedAt)}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={htmlReportUrl}
                readOnly
                style={{
                  flex: 1,
                  padding: '0.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: '#f8fafc',
                  color: '#475569',
                  fontFamily: 'monospace'
                }}
              />
              <button
                onClick={() => copyToClipboard(htmlReportUrl, 'html')}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: copiedHtml ? '#10b981' : '#fff',
                  backgroundColor: copiedHtml ? '#d1fae5' : '#8230c9',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap'
                }}
              >
                {copiedHtml ? '✓ Copied!' : 'Copy Link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
