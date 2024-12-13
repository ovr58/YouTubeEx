import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch'; 

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const API_KEY = process.env.YOUTUBE_API;

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

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});