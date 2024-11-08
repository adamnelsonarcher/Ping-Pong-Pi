const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const dataFilePath = path.join(__dirname, 'public', 'data', 'data.json');

// Get all data
app.get('/api/getData', async (req, res) => {
  try {
    const data = await fs.readFile(dataFilePath, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// Save data
app.post('/api/saveData', async (req, res) => {
  try {
    // Read existing data
    const existingData = JSON.parse(await fs.readFile(dataFilePath, 'utf8'));
    
    // Update data with the new data structure
    const newData = req.body;
    
    // Write back to file
    await fs.writeFile(dataFilePath, JSON.stringify(newData, null, 2));
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
