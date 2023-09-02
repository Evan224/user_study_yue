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
    accessKeyId: "AKIATO7GRX2PG64CSHF2",
    secretAccessKey:"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",
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

app.get('/images', async (req, res) => {
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

        res.json(imagePairs);
    } catch (error) {
        console.error("S3 Error:", error);
        res.status(500).send('Error fetching images from S3');
    }
});

app.post('/report', (req, res) => {
    const reportData = req.body;
    const reportName = 'report' + reportData?.userInfo?.name + '.json';

    // Save the report data to the "results" folder in S3
    const params = {
        Bucket: 'user-study-yue',
        Key: `results/${reportName}`,
        Body: JSON.stringify(reportData, null, 2),
        ContentType: 'application/json'
    };

    s3.putObject(params, (err, data) => {
        if (err) {
            console.error("Error saving report to S3:", err);
            return res.status(500).send('Error saving report to S3');
        }
        res.send('Report saved successfully to S3');
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
