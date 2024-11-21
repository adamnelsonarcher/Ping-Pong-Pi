const admin = require('./firebase-admin');
const db = admin.firestore();

module.exports = async (req, res) => {
  try {
    console.log('Received save request:', req.body);
    
    const encodedUser = req.body.currentUser.replace(/\./g, '_DOT_');
    
    const docRef = db.collection('pingpong').doc('data');
    const doc = await docRef.get();
    let currentData = doc.exists ? doc.data() : {};
    
    if (!currentData.users) {
      currentData.users = {};
    }
    
    await docRef.set({
      users: {
        ...currentData.users,
        [encodedUser]: {
          settings: req.body.settings,
          players: req.body.players,
          gameHistory: req.body.gameHistory
        }
      }
    }, { merge: true });
    
    res.json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error('Error saving data:', error);
    res.status(500).json({ error: error.message });
  }
}; 