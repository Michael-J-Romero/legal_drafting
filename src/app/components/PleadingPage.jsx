'use client';

import React from 'react';
import { formatDisplayDate } from '../lib/date';

// Local constant for visual line numbers on pleading paper
const PLEADING_LINE_COUNT = 28;

export default function PleadingPage({ heading, title, children, pageNumber, totalPages, firstPage = false, docDate, signatureType = 'default', hideHeaderBlocks = false, preTitleCaptions = [], suppressTitlePlaceholder = false, showSignature = null, debugLayout = false, showPageNumbers = true, pageNumberPlacement = 'right' }) {
  const {
    leftFields = [],
    rightFields = [],
    plaintiffName = '',
    defendantName = '',
    courtTitle = '',
  } = heading || {};

  const normalizedLeft = leftFields.filter((value) => value.trim());
  const normalizedRight = rightFields.filter((value) => value.trim());
  const upperTitle = (title || '').trim().toUpperCase();
  const debugMainStyle = debugLayout ? { outline: '2px dashed rgba(255,0,0,0.6)' } : undefined;
  const debugBodyStyle = debugLayout ? { outline: '2px solid rgba(255,0,0,0.9)', position: 'relative' } : undefined;
  const debugFooterStyle = debugLayout ? { outline: '2px dotted rgba(255,0,0,0.7)' } : undefined;
  const debugHeaderStyle = debugLayout ? { outline: '1px dashed rgba(255,0,0,0.3)' } : undefined;

  return (
    <div className="page-surface markdown-fragment">
      <div className="pleading-paper">
        <div className="pleading-line-column" aria-hidden>
          {Array.from({ length: PLEADING_LINE_COUNT }, (_, index) => (
            <span key={`line-${index}`}>{index + 1}</span>
          ))}
        </div>
        <div className="pleading-main" style={debugMainStyle}>
          {firstPage && !hideHeaderBlocks && (
            <>
              <header className="pleading-header" style={debugHeaderStyle}>
                <div className="pleading-contact">
                  {normalizedLeft.length ? (
                    normalizedLeft.map((value, index) => (
                      <div key={`left-field-${index}`} className="pleading-contact-line">
                        {value}
                      </div>
                    ))
                  ) : (
                    <div className="pleading-contact-line pleading-placeholder">Attorney or party information</div>
                  )}
                </div>
                <div className="pleading-clerk-space" aria-hidden />
              </header>

              {courtTitle?.trim() ? (
                <div className="pleading-court-title">{courtTitle.trim().toUpperCase()}</div>
              ) : null}

              <div className="pleading-caption">
                <div className="pleading-caption-left">
                  <div className="pleading-caption-box">
                    <div className="pleading-party-block">
                      <span className="pleading-party-value">{plaintiffName || 'Plaintiff Name'},</span>
                      <span className="pleading-party-label">Plaintiff,</span>
                    </div>
                    <div className="pleading-versus">v.</div>
                    <div className="pleading-party-block">
                      <span className="pleading-party-value">{defendantName || 'Defendant Name'},</span>
                      <span className="pleading-party-label">Defendant,</span>
                    </div>
                  </div>
                </div>
                <div className="pleading-caption-right">
                  {normalizedRight.length ? (
                    normalizedRight.map((value, index) => (
                      <div key={`right-field-${index}`} className="pleading-right-line">
                        {value}
                      </div>
                    ))
                  ) : (
                    <div className="pleading-right-line pleading-placeholder">
                      Court, judge, department details
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {firstPage && (
            <>
              {/* Optional caption stack above the title */}
              {Array.isArray(preTitleCaptions) && preTitleCaptions.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {preTitleCaptions.filter(Boolean).map((line, idx) => (
                    <div key={`pre-cap-${idx}`} style={{ fontWeight: 'bold' }}>{line}</div>
                  ))}
                </div>
              )}
              {!suppressTitlePlaceholder && (
                <div className="pleading-document-title">
                  {upperTitle || 'DOCUMENT TITLE'}
                </div>
              )}
            </>
          )}

          <div className="pleading-body" style={debugBodyStyle}>{children}</div>
          {(showSignature === true || (showSignature === null && pageNumber === totalPages)) && (
            <>
              <div className="signature-gap" aria-hidden />
              {signatureType === 'proposed-order' ? (
                <div className="signature-row signature-po">
                  <div className="po-ordered">IT IS SO ORDERED.</div>
                  <div className="po-dated">Dated: ________________</div>
                  <div className="po-judge-line">__________________________________</div>
                  <div className="po-judge-title">JUDGE OF THE SUPERIOR COURT</div>
                </div>
              ) : signatureType === 'declaration' ? (
                <div className="signature-row">
                  <div className="signature-date">
                    Executed on {formatDisplayDate(docDate)}, at <strong>Los Angeles, California</strong>.
                  </div>
                  <div className="signature-line">
                    <span className="signature-label">Signature:</span>
                    <img
                      src="/sig.png"
                      alt="Signature"
                      className="signature-image"
                      onError={(e) => {
                        // Fallback to existing asset name if user's sig.png isn't present
                        if (e.currentTarget && e.currentTarget.getAttribute('src') !== '/signature.png') {
                          e.currentTarget.setAttribute('src', '/signature.png');
                        }
                      }}
                    />
                  </div>
                  <div className="signature-printed-name">{(plaintiffName || 'Michael James Romero').trim()}, Plaintiff in Pro Per</div>
                </div>
              ) : (
                <div className="signature-row">
                  <div className="signature-date">Dated: {formatDisplayDate(docDate)}</div>
                  <div className="signature-line">
                    <span className="signature-label">Signature:</span>
                    <img
                      src="/sig.png"
                      alt="Signature"
                      className="signature-image"
                      onError={(e) => {
                        // Fallback to existing asset name if user's sig.png isn't present
                        if (e.currentTarget && e.currentTarget.getAttribute('src') !== '/signature.png') {
                          e.currentTarget.setAttribute('src', '/signature.png');
                        }
                      }}
                    />
                  </div>
                  <div className="signature-printed-name">{(plaintiffName || 'Michael James Romero').trim()}, Plaintiff in Pro Per</div>
                </div>
              )}
            </>
          )}
          <div 
            className={`page-footer page-footer-${pageNumberPlacement || 'right'}`} 
            aria-hidden 
            style={debugFooterStyle}
          >
            {showPageNumbers ? (
              <span>
                Page {pageNumber} of {totalPages}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
