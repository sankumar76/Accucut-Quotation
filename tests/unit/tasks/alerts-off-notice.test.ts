import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AlertsOffNotice } from '@/components/features/tasks/alerts-off-notice';
import { ALERTS_OFF_TITLE, alertsOffBody } from '@/components/features/tasks/assign-texts';

/**
 * STORY-09.03 AC-6 (SCR-04, UX-21): with alerts OFF and an Engineer chosen, the assign page says that the Engineer will not be e-mailed and that the task still appears in their queue;
 * with alerts ON, or before an Engineer is chosen, there is no notice. The words are the story's, written out here and not imported, so a changed sentence fails. A browser's view of it
 * (the three widths, axe) is `tests/e2e/assign-task.spec.ts`. Every name is invented.
 */

const html = (alertsEnabled: boolean, engineerName: string | null): string => renderToStaticMarkup(createElement(AlertsOffNotice, { alertsEnabled, engineerName }));

describe('AC-6: the notice of the assign page', () => {
  it('alerts OFF and an Engineer chosen: "E-mail alerts are OFF. <name> will not be e-mailed about this task. It still appears in their queue."', () => {
    const markup = html(false, 'Invented Arjun');
    expect(markup).toContain('E-mail alerts are OFF.');
    expect(markup).toContain('Invented Arjun will not be e-mailed about this task. It still appears in their queue.');
    expect(ALERTS_OFF_TITLE).toBe('E-mail alerts are OFF.');
    expect(alertsOffBody('Invented Arjun')).toBe('Invented Arjun will not be e-mailed about this task. It still appears in their queue.');
  });

  it('alerts ON: no notice, whichever Engineer is chosen', () => {
    const markup = html(true, 'Invented Arjun');
    expect(markup).not.toContain('E-mail alerts are OFF');
    expect(markup).not.toContain('will not be e-mailed');
  });

  it('alerts OFF and no Engineer chosen yet: no notice (there is nobody to name)', () => {
    expect(html(false, null)).not.toContain('E-mail alerts are OFF');
  });

  it('keeps one live region in the page whether the notice shows or not, so the words are announced when an Engineer is chosen', () => {
    for (const markup of [html(false, 'Invented Arjun'), html(true, 'Invented Arjun'), html(false, null)]) expect(markup).toContain('role="status"');
  });

  it('writes a name that holds markup as text', () => {
    const markup = html(false, '<b>Invented</b>');
    expect(markup).not.toContain('<b>Invented</b>');
    expect(markup).toContain('&lt;b&gt;Invented&lt;/b&gt;');
  });
});
