const admin = require('./firebase-admin');
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    const encodedUser = req.query.userId.replace(/\./g, '_DOT_');
    const doc = await db.collection('pingpong').doc('data').get();
    const data = doc.exists ? doc.data() : { users: {} };
    
    if (!data.users) {
      data.users = {};
    }
    
    res.json(data.users[encodedUser] || {
      settings: {},
      players: {},
      gameHistory: []
    });
  } catch (error) {
    console.error('Error reading data:', error);
    res.status(500).json({ error: error.message });
  }
}; 