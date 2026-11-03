'use client';

// A client component that imports the formula engine. The build must fail (STORY-03.02 AC-8).
import { toInternalForm } from '../../../../../src/lib/formula';

export default function Page() {
  return <p>{typeof toInternalForm}</p>;
}
