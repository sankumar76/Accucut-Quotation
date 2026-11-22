# Request to Accucut IT: mail settings for the Quotation Portal

**To:** Accucut IT (the person who looks after the company mail)
**From:** [Delivery lead name], Accucut Quotation Portal
**Needed by:** 28 November 2026 (a Saturday, so Friday 27 November if you can)
**Reply to:** [Delivery lead name], by e-mail only (not Jira, GitHub or chat)

## Why we are asking

The portal sends quotation-related e-mail: a new-task alert, an overdue alert, a daily 11:00 AM digest and the password-reset link. We have tested all of it against a dummy mail server. One real test through your real mailbox is still needed (our step 09.08). It has to happen before 1 December 2026, when we ask for release sign-off, so we need your answers by 28 November to leave a few days for the test. You told us the company uses Microsoft 365, so the table assumes that. If your set-up differs, say so in the "Your answer" column.

## What we need

Please fill in the right-hand column. Write "not applicable" where it does not apply.

| # | What we need | Portal setting | Your answer |
|---|---|---|---|
| 1 | **Sender address (From).** A dedicated mailbox for the portal that holds no other mail. The sender must be this mailbox, or one it has "Send As" rights on, otherwise Microsoft refuses the message. | Entered in Settings by the Admin | |
| 2 | Display name recipients will see, if you want one (for example "Accucut Quotation Portal") | Entered in Settings by the Admin | |
| 3 | Reply-to address, if replies should go somewhere else (optional) | | |
| 4 | **SMTP host name.** We expect `smtp.office365.com` for Microsoft 365. | `SMTP_HOST` | |
| 5 | **Port.** We expect 587. | `SMTP_PORT` | |
| 6 | **Connection security.** We expect STARTTLS on 587, or implicit TLS on 465. The portal will not send in clear text. | | |
| 7 | **Sign-in method.** Microsoft is retiring user name and password for SMTP, so we prefer an app sign-in (OAuth 2.0 client credentials): you register an app, grant it `SMTP.SendAsApp`, and give it access to this one mailbox. If you allow user name and password for this mailbox instead, tell us. | `SMTP_AUTH_MODE` | |
| 8 | **Account user name** that signs in (normally the mailbox address). Not the password. | `SMTP_USER` | |
| 9 | If you chose the app sign-in: confirm the app is registered and which date its client secret expires. We need the date and who will renew it, not the secret. | | |
| 10 | Is SMTP AUTH enabled for this mailbox, and is Security Defaults on in your tenant? | | |
| 11 | Can the portal server reach your mail host outward on the port in row 5? Any sending limits we should respect? (We stay under Microsoft's 30 messages a minute.) | | |
| 12 | Does your firewall or mail system allow-list sending servers? If so, we will give you the server's public IP address. | | |
| 13 | If you manage the DNS for the sender domain: are SPF and DKIM set up so that mail from this address is not marked as spam? | | |
| 14 | A **test recipient mailbox** that your team controls and that is not a real employee's, for the 09.08 check. | | |

## The password, the app secret and the IDs

**Do not send the password by email, chat or Jira.** It is entered only into the server's environment file during installation, by the person who installs it. The same applies to the app's client secret (`SMTP_OAUTH_CLIENT_SECRET`) and, if you choose that route, to `SMTP_PASSWORD`. The app's tenant ID and client ID (`SMTP_OAUTH_TENANT_ID`, `SMTP_OAUTH_CLIENT_ID`) are not secret, but there is no need to send them either: they go into the same file at installation. We never need to see any of these values.

## If we cannot get these in time

The rest of the portal does not wait for this. E-mail alerts stay switched off (`FEATURE_EMAIL` stays off) until the real test passes, and the release sign-off would record that e-mail is not yet proven. If your organisation does not allow SMTP sign-in at all, tell us. We have fallbacks (about half a day of work each), and we would rather know now.

Thank you. Please reply to [Delivery lead name] with the filled table.

*Reference for the delivery team: Q-18, OQ-ARCH-11, STORY-09.08 (AQP-355), architecture section 4.7.*
