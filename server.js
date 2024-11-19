const express = require('express');
const cors = require('cors');
const getData = require('./api/getData');
const saveData = require('./api/saveData');

const app = express();

app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));

app.use(express.json());

app.get('/api/getData', getData);
app.post('/api/saveData', saveData);

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
