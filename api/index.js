const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const fs = require('fs');
const cors = require('cors');
const app = express();
const PORT = 3000;

// AWS Configuration
AWS.config.update({
    region: 'eu-north-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
const s3 = new AWS.S3();

app.use(bodyParser.json());
app.use(cors());
// API to fetch image list from S3

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

app.get('/api', (req, res) => {
    const path = `/api/item/${v4()}`;
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
    res.end(`Hello! Go to item: <a href="${path}">${path}</a>`);
  });
  
  app.get('/api/item/:slug', (req, res) => {
    const { slug } = req.params;
    res.end(`Item: ${slug}`);
  });

app.get('/api/images', async (req, res) => {
    try {
        const params = {
            Bucket: 'user-study-yue'
        };

        const data = await s3.listObjectsV2(params).promise();

        const mlsImages = data.Contents.filter(item => item.Key.startsWith('mls/')).map(item => item.Key);

        // Shuffle the mlsImages array
        shuffleArray(mlsImages);

        // Select the first 100 images (or all if there are fewer than 100)
        const selectedMlsImages = mlsImages.slice(0, 100);

        const imagePairs = selectedMlsImages.map((mlsImage, index) => {
            const imageName = mlsImage.split('/')[1].split('.')[0];
            const correspondingGridImage = `grids/${imageName}_grid.jpg`;

            // Generate pre-signed URLs
            const mlsPresignedUrl = s3.getSignedUrl('getObject', {
                Bucket: 'user-study-yue',
                Key: mlsImage,
                Expires: 3600
            });

            const gridPresignedUrl = s3.getSignedUrl('getObject', {
                Bucket: 'user-study-yue',
                Key: correspondingGridImage,
                Expires: 3600
            });

            // Randomly swap left and right
            const isSwap = Math.random() >= 0.5;
            const leftImage = isSwap ? gridPresignedUrl : mlsPresignedUrl;
            const rightImage = isSwap ? mlsPresignedUrl : gridPresignedUrl;

            return {
                id: index + 1,
                left: leftImage,
                right: rightImage,
                name: imageName,
                grid: !isSwap ? 'right' : 'left'
            };
        });
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');

        res.json(imagePairs);
    } catch (error) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');
        console.error("S3 Error:", error);
        res.status(500).send('Error fetching images from S3');
    }
});

app.post('/api/report', (req, res) => {
    const reportData = req.body;
    const reportName = 'report' + reportData?.userInfo?.name + '.json';

    // Save the report data to the "results" folder in S3
    const params = {
        Bucket: 'user-study-yue',
        Key: `results/${reportName}`,
        Body: JSON.stringify(reportData, null, 2),
        ContentType: 'application/json'
    };
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-max-age=1, stale-while-revalidate');

    s3.putObject(params, (err, data) => {
        if (err) {
            console.error("Error saving report to S3:", err);
            return res.status(500).send('Error saving report to S3');
        }
        res.send(JSON.stringify({
            message: 'Report saved successfully'
        }));
    });
});

app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api/reports', async (req, res) => {
    try {
        const params = {
            Bucket: 'user-study-yue',
            Prefix: 'results/'
        };

        const data = await s3.listObjectsV2(params).promise();

        const reports = data.Contents.map(item => item.Key);

        res.json(reports);
    } catch (error) {
        console.error("S3 Error:", error);
        res.status(500).send('Error fetching reports from S3');
    }
});

module.exports = app;
