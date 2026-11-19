import { createServer, type Server, type Socket } from 'node:net';

/**
 * A small SMTP server for tests that must make a real Nodemailer connection fail in a chosen way (STORY-09.01 AC-3 and AC-7). It speaks just enough SMTP for Nodemailer: EHLO, AUTH
 * (one mechanism), MAIL FROM, RCPT TO, DATA and QUIT, in clear text on a free local port. It can refuse the sign-in in the way a hostile or careless server does, by echoing what it was
 * given, and can refuse the sender with Microsoft's 5.7.60. It never relays anything. Capturing messages that arrive is Mailpit's or the stub's job (`mail-capture.ts`), not this one's.
 */

export interface FakeSmtpOptions {
  /** The one mechanism the server offers. */
  readonly mechanism: 'PLAIN' | 'XOAUTH2';
  /** `accept`: the sign-in works. `reject-echo`: 535, with the credentials it was given repeated in the reply (the worst a server can do). */
  readonly auth: 'accept' | 'reject-echo';
  /** `accept`, or `sender-not-allowed`: 550 5.7.60, as Microsoft answers for a From that is not the mailbox. */
  readonly sender: 'accept' | 'sender-not-allowed';
}

export interface FakeSmtp {
  readonly port: number;
  /** Everything the client sent after the greeting, one line per entry. */
  readonly lines: string[];
  close(): Promise<void>;
}

export async function startFakeSmtp(options: FakeSmtpOptions): Promise<FakeSmtp> {
  const lines: string[] = [];
  const sockets = new Set<Socket>();

  const server: Server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => undefined);
    let buffered = '';
    let inData = false;
    socket.write('220 fake.example.com ESMTP ready\r\n');
    socket.on('data', (chunk: Buffer) => {
      buffered += chunk.toString('utf8');
      let end = buffered.indexOf('\r\n');
      while (end !== -1) {
        const line = buffered.slice(0, end);
        buffered = buffered.slice(end + 2);
        end = buffered.indexOf('\r\n');
        lines.push(line);
        if (inData) {
          if (line === '.') {
            inData = false;
            socket.write('250 2.0.0 queued\r\n');
          }
          continue;
        }
        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write(`250-fake.example.com\r\n250-AUTH ${options.mechanism}\r\n250 SIZE 10485760\r\n`);
        } else if (command.startsWith('AUTH')) {
          if (options.auth === 'accept') socket.write('235 2.7.0 Authentication successful\r\n');
          else socket.write(`535 5.7.3 Authentication unsuccessful for ${Buffer.from(line.split(' ').at(-1) ?? '', 'base64').toString('utf8').replaceAll('\u0000', ' ')}\r\n`);
        } else if (command.startsWith('MAIL FROM')) {
          if (options.sender === 'sender-not-allowed') socket.write('550 5.7.60 SMTP; Client does not have permissions to send as this sender\r\n');
          else socket.write('250 2.1.0 sender ok\r\n');
        } else if (command.startsWith('RCPT TO')) {
          socket.write('250 2.1.5 recipient ok\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 go ahead\r\n');
        } else if (command === 'QUIT') {
          socket.end('221 2.0.0 bye\r\n');
        } else {
          socket.write('250 ok\r\n');
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('The fake SMTP server has no port.');

  return {
    port: address.port,
    lines,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
