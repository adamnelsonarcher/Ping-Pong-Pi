const admin = require('./firebase-admin');
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    await db.collection('pingpong').doc('data').set(req.body);
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
}; 