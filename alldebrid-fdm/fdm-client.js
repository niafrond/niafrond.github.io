const { spawn } = require('child_process');

const FDM_HOST_PATH = 'C:\\Program Files\\Softdeluxe\\Free Download Manager\\wenativehost.exe';

function writeMsg(stream, obj) {
    const json = JSON.stringify(obj);
    const byteLen = Buffer.byteLength(json, 'utf8');
    const buf = Buffer.allocUnsafe(4 + byteLen);
    buf.writeUInt32LE(byteLen, 0);
    buf.write(json, 4, 'utf8');
    stream.write(buf);
}

function parseMsgs(buffer) {
    const msgs = [];
    while (buffer.length >= 4) {
        const len = buffer.readUInt32LE(0);
        if (buffer.length < 4 + len) break;
        const json = buffer.slice(4, 4 + len).toString('utf8');
        msgs.push(JSON.parse(json));
        buffer = buffer.slice(4 + len);
    }
    return { msgs, remaining: buffer };
}

function sendToFdm(url) {
    return new Promise((resolve, reject) => {
        let proc;
        try {
            proc = spawn(FDM_HOST_PATH, [], { stdio: ['pipe', 'pipe', 'ignore'] });
        } catch (err) {
            return reject(new Error(`Cannot start FDM native host: ${err.message}`));
        }

        let buffer = Buffer.alloc(0);
        let state = 'handshake';
        let idCounter = 0;
        let settled = false;

        const done = (err, val) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try { proc.stdin.end(); } catch (e) {}
            try { proc.kill(); } catch (e) {}
            if (err) reject(err);
            else resolve(val);
        };

        const timer = setTimeout(() => done(new Error('FDM timeout (5s)')), 5000);

        proc.stdout.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
            const { msgs, remaining } = parseMsgs(buffer);
            buffer = remaining;

            for (const msg of msgs) {
                if (!msg.id) continue; // unsolicited push (key_state, query_settings…)

                if (msg.error && msg.error !== '') {
                    return done(new Error(`FDM: ${msg.error}`));
                }

                if (state === 'handshake') {
                    state = 'download';
                    writeMsg(proc.stdin, {
                        id: (++idCounter).toString(),
                        type: 'create_downloads',
                        create_downloads: {
                            downloads: [{
                                url,
                                originalUrl: url,
                                httpReferer: '',
                                httpCookies: '',
                                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                            }]
                        }
                    });
                } else if (state === 'download') {
                    done(null, { success: true });
                }
            }
        });

        proc.on('error', err => done(new Error(`FDM process error: ${err.message}`)));

        proc.on('exit', () => {
            if (!settled) done(null, { success: true });
        });

        writeMsg(proc.stdin, {
            id: (++idCounter).toString(),
            type: 'handshake',
            handshake: { api_version: '1', browser: 'Chrome' }
        });
    });
}

module.exports = { sendToFdm };
