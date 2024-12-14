import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import cors from 'cors'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API;

app.use(cors());

app.get('/subtitles', async (req, res) => {
    const videoId = req.query.videoId;
    const trackId = req.query.trackId;

    if (!videoId && !trackId) {
        return res.status(400).send('Missing videoId parameter');
    }

    try {
        let response;
        switch (true) {
        case videoId:
            response = await fetch(`https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${API_KEY}`);
        case trackId:
            response = await fetch(`https://www.googleapis.com/youtube/v3/captions/${trackId}?tfmt=srv3&key=${API_KEY}`);
        }
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).send('Error fetching subtitles');
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});