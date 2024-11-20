const express = require('express');
const cors = require('cors');
const getData = require('./getData');
const saveData = require('./saveData');

const app = express();

app.use(cors({
  origin: '*',
  credentials: true
}));

app.use(express.json());

app.get('/api/getData', getData);
app.post('/api/saveData', saveData);

module.exports = app;