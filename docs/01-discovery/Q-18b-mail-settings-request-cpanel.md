# Request to Accucut IT: mail settings for the Quotation Portal (cPanel mail)

**To:** Accucut IT (the person who looks after the company mail)
**From:** [Delivery lead name], Accucut Quotation Portal
**Needed by:** 28 November 2026 (a Saturday, so Friday 27 November if you can)
**Reply to:** [Delivery lead name], by e-mail only (not Jira, GitHub or chat)

*This is the version for company mail kept on a cPanel web host. The earlier version for Microsoft 365 is Q-18 (`Q-18-mail-settings-request.md`); it is kept for reference in case the company moves to Microsoft 365 later.*

## Why we are asking

The portal sends quotation-related e-mail: a new-task alert, an overdue alert, a daily 11:00 AM digest and the password-reset link. We have tested all of it against a dummy mail server. One real test through your real mailbox is still needed (our step 09.08). We plan to run it by 30 November 2026, so that anything it shows can still be put right before we ask for release sign-off in early December. That is why we need your answers by 28 November.

We understand the company mail is hosted on webhostbox.net and managed in cPanel. If that is wrong, say so in the "Your answer" column and we will adjust.

## How the portal will send

The portal signs in to one mailbox with its address and password, the same way a mail program such as Outlook or a phone does, and sends through that mailbox's outgoing (SMTP) server. In plain words:

- Port 465 means the connection is encrypted from the first moment (SSL/TLS). Any other port, such as 587, starts as a normal connection and is then switched to encrypted before anything is sent.
- The portal never sends in clear text. If the server cannot encrypt the connection, nothing is sent.
- The portal checks the server's security certificate against the host name it connects to. If the certificate does not match, it does not send. This is why row 3 below asks which host name to use.

## What we need

Please fill in the right-hand column. Write "not applicable" where it does not apply.

| # | What we need | Why we ask | Your answer |
|---|---|---|---|
| 1 | **Sender mailbox.** Please create a dedicated mailbox for the portal in cPanel, under Email Accounts, and give us its full address. It should hold no other mail. The "From" address of every message will be this same address. | The portal sends as the mailbox that signs in. If the From address were different, the host could refuse the message. | |
| 2 | **Display name** recipients will see, if you want one (for example "Accucut Quotation Portal") | Entered in Settings by the Admin | |
| 3 | **Reply-to address**, if replies should go somewhere else (optional) | Entered in Settings by the Admin | |
| 4 | **Outgoing mail server (SMTP host name).** We would normally try `mail.` followed by your domain. If the security certificate does not cover that name, cPanel's "Connect Devices" page for the mailbox shows the server's own host name instead (it may look like `serverNNN.webhostbox.net`, but please copy exactly what your page shows). Which name does cPanel give for outgoing mail? | If the name does not match the certificate, the portal refuses to send (see above). | |
| 5 | **Port.** cPanel's "Connect Devices" page lists the outgoing port, normally 465 (SSL/TLS) or 587. Which does your page show, and which do you want us to use? | Decides how the connection is encrypted (see above). | |
| 6 | **Account user name** that signs in. We expect it to be the full mailbox address from row 1, not just the part before the @. Please confirm. Not the password. | The host decides which form of user name it accepts. | |
| 7 | **Sending limit.** Does the host limit how many messages the account or the domain may send per hour? If so, what is the number? | The portal sends at most 25 messages a minute. A daily digest to 50 Engineers, for example, is 50 messages, plus alerts and password-reset mail. We will check our volume against your limit before the test. | |
| 8 | **Outward access.** Can the server that will run the portal reach the mail host outward on the port in row 5? Please check with whoever manages the network or firewall there. | If the port is blocked, the first real test fails. | |
| 9 | **SPF and DKIM.** In cPanel, under "Email Deliverability", are SPF and DKIM set up for the sender domain, and does the page report no problems? If not, can you set them up? | Without them, mail from the portal may be marked as spam or rejected. | |
| 10 | A **test recipient mailbox** that your team controls and that is not a real employee's, for the 09.08 check. | We send one real message to it and check that it arrives in the inbox and not in junk. | |

## The password

**Do not send the password by e-mail, chat or Jira.** It is entered only into the server's environment file (`SMTP_PASSWORD`) during installation, by the person who installs it. The host name, port and user name (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`) are not secret; send them in your reply to this request. We never need to see the password.

## If we cannot get these in time

The rest of the portal does not wait for this. E-mail alerts stay switched off (`FEATURE_EMAIL` stays off) until the real test passes, and the release sign-off would record that e-mail is not yet proven. If your host does not allow sending with a mailbox sign-in on 465 or 587, tell us. We would rather know now.

Thank you. Please reply to [Delivery lead name] with the filled table.

*Reference for the delivery team: Q-18 (Microsoft 365 version, kept for reference), Q-18b, OQ-ARCH-11, STORY-09.08 (AQP-355), architecture section 4.7. The portal's route for this document is `SMTP_AUTH_MODE=password` (`src/server/mail/transport.ts`).*
