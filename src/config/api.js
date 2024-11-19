const API_URL = process.env.NODE_ENV === 'production'
  ? 'https://www.pingpongpi.com'
  : 'http://localhost:3001';

export default API_URL; 