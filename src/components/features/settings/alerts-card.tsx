'use client';

import { useRef, useState, type FormEvent } from 'react';

import { FormField } from '@/components/shared/form-field';
import { Notice, type NoticeProps } from '@/components/shared/notice';
import { useFocusOnRefusal } from '@/components/shared/use-focus-on-refusal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { saveAlertSettings, saveResultOf, sendTestEmail, testResultOf, type TestResult } from '@/lib/settings/alerts-client';
import { senderProblems, trimmedSender, type SenderField, type SenderProblems } from '@/lib/settings/validation';

import {
  ALERTS_HEADING,
  ALERTS_OFF,
  ALERTS_OFF_HINT,
  ALERTS_ON,
  ALERTS_ON_HINT,
  ALERTS_SWITCH_LABEL,
  CREDENTIALS_NOTE,
  EMAIL_NOT_ENABLED,
  NO_SENDER_BODY,
  NO_SENDER_TITLE,
  SAVE_FAILED_BODY,
  SAVE_FAILED_TITLE,
  SAVE_LABEL,
  SAVED_BODY,
  SAVED_TITLE,
  SAVING_LABEL,
  SENDER_ADDRESS_LABEL,
  SENDER_NAME_LABEL,
  SENDER_NOT_ALLOWED_BODY,
  SENDER_NOT_ALLOWED_TITLE,
  TEST_FAILED_BODY,
  TEST_FAILED_TITLE,
  TEST_LABEL,
  TEST_SENT_TITLE,
  testHint,
  testSentBody,
  TESTING_LABEL,
} from './texts';

export interface AlertsCardProps {
  readonly initial: { readonly alertsEnabled: boolean; readonly senderName: string; readonly senderAddress: string };
  /** False when `FEATURE_EMAIL` is off on this server: one line says so, and nothing else changes. */
  readonly emailEnabled: boolean;
  /** The signed-in Admin's own address, shown as the place the test e-mail goes. The server decides the recipient; this only says it. */
  readonly adminAddress: string;
}

type Result =
  | { readonly kind: 'saved' }
  | { readonly kind: 'save-failed' }
  | { readonly kind: 'test'; readonly result: TestResult };

const FIELD_ORDER: ReadonlyArray<SenderField> = ['senderName', 'senderAddress'];

/** What the result notice says, in the words of SCR-15 (or the proposed ones, `texts.ts`). Success is polite; so is every failure here, because the notice sits in a polite live region (NFR-017). */
function noticeFor(result: Result): { readonly tone: NoticeProps['tone']; readonly title: string; readonly body: string } {
  if (result.kind === 'saved') return { tone: 'success', title: SAVED_TITLE, body: SAVED_BODY };
  if (result.kind === 'save-failed') return { tone: 'danger', title: SAVE_FAILED_TITLE, body: SAVE_FAILED_BODY };
  switch (result.result.kind) {
    case 'sent':
      return { tone: 'success', title: TEST_SENT_TITLE, body: testSentBody(result.result.sentTo) };
    case 'sender-not-allowed':
      return { tone: 'danger', title: SENDER_NOT_ALLOWED_TITLE, body: SENDER_NOT_ALLOWED_BODY };
    case 'no-sender':
      return { tone: 'danger', title: NO_SENDER_TITLE, body: NO_SENDER_BODY };
    case 'failed':
      return { tone: 'danger', title: TEST_FAILED_TITLE, body: TEST_FAILED_BODY };
  }
}

function withoutProblem(problems: SenderProblems, field: SenderField): SenderProblems {
  return Object.fromEntries(Object.entries(problems).filter(([name]) => name !== field));
}

/**
 * SCR-15 "E-mail alerts" (STORY-09.02 AC-1, AC-3 to AC-5, AC-8, AC-9; FR-019): the switch (role `switch`, its state written in words), the sender name and address, Save settings and Send
 * test e-mail. The form shows and sends; the server decides (the rules of a name and an address, the recipient of the test e-mail, the sending). The shared rules are checked on Save so a
 * message appears at once, and the server's messages are put under the field they name; focus then goes to the first field with a message. The fields keep what was typed after every
 * refusal and every failure (WCAG 3.3.7). The result of Save and of the test is one notice in a polite live region, and the sender stays editable after "Sender not allowed".
 *
 * The test e-mail is always sent from the SAVED sender, to the Admin's own address, and the page says so; it sends nothing typed here. The mail server's credentials are not on this page
 * and not in the API: the card says they are set on the server by Accucut IT.
 */
export function AlertsCard({ initial, emailEnabled, adminAddress }: AlertsCardProps) {
  const [alertsEnabled, setAlertsEnabled] = useState(initial.alertsEnabled);
  const [senderName, setSenderName] = useState(initial.senderName);
  const [senderAddress, setSenderAddress] = useState(initial.senderAddress);
  const [problems, setProblems] = useState<SenderProblems>({});
  const [result, setResult] = useState<Result | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const busy = saving || testing;

  const focusField = (field: SenderField): void => (field === 'senderName' ? nameRef : addressRef).current?.focus();
  const showProblems = useFocusOnRefusal(FIELD_ORDER, focusField, setProblems);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setResult(null);
    const input = { alertsEnabled, senderName, senderAddress };
    const found = senderProblems(input);
    showProblems(found);
    if (Object.keys(found).length > 0) return;

    setSaving(true);
    const saved = saveResultOf(await saveAlertSettings(trimmedSender(input)));
    setSaving(false);
    if (saved.kind === 'fields') return showProblems(saved.problems);
    if (saved.kind === 'failed') return setResult({ kind: 'save-failed' });
    // What is shown is what is stored: the values as saved (trimmed).
    setAlertsEnabled(saved.saved.alertsEnabled);
    setSenderName(saved.saved.senderName);
    setSenderAddress(saved.saved.senderAddress);
    setResult({ kind: 'saved' });
  }

  async function onTest(): Promise<void> {
    if (busy) return;
    setResult(null);
    setTesting(true);
    const tested = testResultOf(await sendTestEmail());
    setTesting(false);
    setResult({ kind: 'test', result: tested });
  }

  const shown = result === null ? null : noticeFor(result);

  return (
    <Card>
      <form noValidate aria-label={ALERTS_HEADING} onSubmit={(event) => void onSubmit(event)}>
        <CardHeader>
          <CardTitle>{ALERTS_HEADING}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-s-4">
          {emailEnabled ? null : <Notice tone="info">{EMAIL_NOT_ENABLED}</Notice>}

          <div className="flex min-w-0 flex-col gap-s-2">
            <div className="flex items-center gap-s-3">
              <Switch
                id="alerts-switch"
                checked={alertsEnabled}
                onCheckedChange={(next) => {
                  setAlertsEnabled(next);
                  setResult(null);
                  // The address is needed only while alerts are ON, so a message about it can become wrong when the switch moves.
                  setProblems((current) => withoutProblem(current, 'senderAddress'));
                }}
                aria-describedby="alerts-switch-hint"
              />
              <Label htmlFor="alerts-switch">
                {ALERTS_SWITCH_LABEL}: {alertsEnabled ? ALERTS_ON : ALERTS_OFF}
              </Label>
            </div>
            <p id="alerts-switch-hint" className="text-label text-ink-3">
              {alertsEnabled ? ALERTS_ON_HINT : ALERTS_OFF_HINT}
            </p>
          </div>

          <FormField id="sender-name" label={SENDER_NAME_LABEL} {...(problems.senderName === undefined ? {} : { error: problems.senderName })}>
            {(control) => (
              <Input
                {...control}
                ref={nameRef}
                value={senderName}
                autoComplete="off"
                onChange={(event) => {
                  setSenderName(event.target.value);
                  setProblems((current) => withoutProblem(current, 'senderName'));
                  setResult(null);
                }}
              />
            )}
          </FormField>

          <FormField
            id="sender-address"
            label={SENDER_ADDRESS_LABEL}
            hint={CREDENTIALS_NOTE}
            {...(problems.senderAddress === undefined ? {} : { error: problems.senderAddress })}
          >
            {(control) => (
              <Input
                {...control}
                ref={addressRef}
                type="email"
                inputMode="email"
                autoComplete="off"
                value={senderAddress}
                onChange={(event) => {
                  setSenderAddress(event.target.value);
                  setProblems((current) => withoutProblem(current, 'senderAddress'));
                  setResult(null);
                }}
              />
            )}
          </FormField>

          {/* One polite live region for the result of Save and of the test: it is in the page before there is anything to say, so the message is read when it arrives. */}
          <div aria-live="polite" aria-atomic="true" className="empty:hidden">
            {shown === null ? null : (
              <Notice tone={shown.tone} title={shown.title} role="status">
                {shown.body}
              </Notice>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" loading={saving} disabled={testing}>
            {saving ? SAVING_LABEL : SAVE_LABEL}
          </Button>
          <Button type="button" variant="secondary" loading={testing} disabled={saving} onClick={() => void onTest()}>
            {testing ? TESTING_LABEL : TEST_LABEL}
          </Button>
          <p className="min-w-0 basis-full text-label text-ink-3">{testHint(adminAddress)}</p>
        </CardFooter>
      </form>
    </Card>
  );
}
