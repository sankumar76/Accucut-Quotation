/**
 * The words of the download marker chip (STORY-CR01.7E; UX spec section 0.9 row 7c): the one place every screen that shows the chip gets them from, so SCR-10, SCR-06's header, the Closed tab and the quote dialog
 * say the same thing. The times are written in IST by the caller (`formatIst`).
 */

export const NOT_DOWNLOADED = 'Not downloaded';

/** What a screen says when the marker could not be read (STORY-CR01.7E, QLT-03): never "Not downloaded" for a marker it does not have. */
export const DOWNLOAD_STATUS_UNAVAILABLE = 'Download status unavailable.';
export const CHANGED_SINCE_DOWNLOAD = 'Changed since download';

/** "Downloaded 3×": the number of files handed over so far. */
export const downloadedLabel = (count: number): string => `Downloaded ${String(count)}×`;

/** Who downloaded last and when: "Last downloaded by Invented Lead, 23 Nov 2026, 10:00 IST". */
export const lastDownloadLine = (byName: string, at: string): string => `Last downloaded by ${byName}, ${at}`;

/** The one sentence under an amber chip that says why it is amber (the words and the icon say it, never the colour alone). */
export const CHANGED_EXPLANATION = 'The approval changed after the last download, so the file the customer has may not match the current approved price.';
