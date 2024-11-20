const admin = require('./firebase-admin');
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const doc = await db.collection('pingpong').doc('data').get();
    const data = doc.exists ? doc.data() : { users: {} };
    
    const userData = data.users[userId] || {
      settings: {},
      players: {},
      gameHistory: []
    };
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ error: 'Failed to read data' });
  }
}; 