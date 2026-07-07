require('dotenv').config();
const express = require('express');
const path = require('path');
const { sendToFdm } = require('./fdm-client');

const app = express();
const PORT = process.env.PORT || 3333;
const ALLDEBRID_AGENT = 'alldebrid-fdm';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function debridLink(url, apiKey) {
    const params = new URLSearchParams({ link: url, agent: ALLDEBRID_AGENT });
    const res = await fetch('https://api.alldebrid.com/v4/link/unlock', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
    });
    const data = await res.json();
    if (data.status !== 'success') {
        throw new Error(data.error?.message || `AllDebrid error: ${data.status}`);
    }
    return data.data;
}

// POST /api/send  { url, apiKey? }
// Debride via AllDebrid then send direct link to local FDM
app.post('/api/send', async (req, res) => {
    const { url, apiKey } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const key = apiKey || process.env.ALLDEBRID_APIKEY;
    if (!key) return res.status(400).json({ error: 'Missing AllDebrid API key' });

    try {
        const debrided = await debridLink(url, key);
        await sendToFdm(debrided.link);
        res.json({ success: true, filename: debrided.filename, filesize: debrided.filesize, directLink: debrided.link });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/debrid  { url, apiKey? }  – just debride, don't send to FDM
app.post('/api/debrid', async (req, res) => {
    const { url, apiKey } = req.body;
    if (!url) return res.status(400).json({ error: 'Missing url' });

    const key = apiKey || process.env.ALLDEBRID_APIKEY;
    if (!key) return res.status(400).json({ error: 'Missing AllDebrid API key' });

    try {
        const debrided = await debridLink(url, key);
        res.json({ success: true, ...debrided });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`alldebrid-fdm running on http://localhost:${PORT}`);
});
