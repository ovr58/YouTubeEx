import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors'; 
import { OAuth2Client } from 'google-auth-library';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API;

const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;

const oauth2Client = new OAuth2Client(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);

app.use(cors());

app.get('/auth', (req, res) => {

    const url = oauth2Client.generateAuthUrl({
        access_type: 'offline', 
        scope: ['https://www.googleapis.com/auth/youtube.readonly'], 
    })
    console.log('URL:', url);
    res.redirect(url);
});

app.get('/oauth2callback', async (req, res) => {
    const code = req.query.code;
    console.log('Code:', code);
    const { tokens } = await oauth2Client.getToken(code);
    console.log('Tokens:', tokens);
    oauth2Client.setCredentials(tokens);
    res.send('Authentication successful! You can close this tab.');
});

app.get('/subtitles', async (req, res) => {
    const videoId = req.query.videoId;
    
    if (!videoId) {
        return res.status(400).send('Missing videoId parameter');
    }

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${API_KEY}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).send('Error fetching subtitles');
    }
});

app.get('/content', async (req, res) => {
    const trackId = req.query.trackId;
    console.log('trackId:', trackId);
    if (!trackId) {
        return res.status(400).send('Missing trackId parameter');
    }

    try {
        const response = await fetch(`https://www.googleapis.com/youtube/v3/captions/${trackId}?tfmt=srv3`, {
            headers: {
                Authorization: `Bearer ${oauth2Client.credentials.access_token}`,
                Accept: 'application/json'
            }
        });
        console.log('Response:', response);
        const data = await response.json();
        console.log('Content:', data);
        res.json(data);
    } catch (error) {
        console.log('Error fetching subtitles:', error);
        res.status(500).send('Error fetching subtitles');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});