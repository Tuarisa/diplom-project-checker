const express = require('express');
const path = require('path');
const fs = require('fs');
const { globSync } = require('glob');
const { WORKING_DIR } = require('../paths');

const router = express.Router();

// Serve static files
router.use(express.static(path.join(__dirname, 'public')));

// Main page - list of HTML files
router.get('/', (req, res) => {
    const htmlFiles = globSync('**/*.html', {
        cwd: WORKING_DIR,
        nodir: true,
        ignore: ['**/node_modules/**', '**/.*/**']
    });
    
    res.render('index', {
        files: htmlFiles.map(file => ({
            path: file,
            name: path.basename(file)
        }))
    });
});

// View specific file
router.get('/view/:file(*)', (req, res) => {
    const filePath = req.params.file;
    const fullPath = path.join(WORKING_DIR, filePath);
    
    try {
        const content = fs.readFileSync(fullPath, 'utf8');
        res.render('view', {
            fileName: path.basename(filePath),
            content: content
        });
    } catch (err) {
        res.status(404).send('File not found');
    }
});

module.exports = router; 