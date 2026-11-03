// A server component that imports the formula engine. The build must succeed: this is the control that shows
// the failure of the client fixture is about `server-only` and nothing else (STORY-03.02 AC-8).
import { toInternalForm } from '../../../../../src/lib/formula';

export default function Page() {
  return <p>{typeof toInternalForm}</p>;
}
