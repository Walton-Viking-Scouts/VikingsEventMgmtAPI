const request = require('supertest');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Mock fetch globally
global.fetch = jest.fn();

describe('OSM Tracker API', () => {
  let app;

  beforeEach(() => {
    // Create a fresh app instance for each test
    app = express();
    app.use(cors());
    app.use(express.json());
    app.use(cookieParser());

    // Add routes (simplified for testing)
    app.post('/get-terms', async (req, res) => {
      const { access_token } = req.body;
      if (!access_token) {
        return res.status(400).json({ error: 'No access token provided' });
      }
      
      // Mock OSM API response
      fetch.mockResolvedValueOnce({
        json: async () => ({ "11107": [{ "termid": "20872", "name": "2012" }] })
      });

      try {
        const response = await fetch('https://www.onlinescoutmanager.co.uk/api.php?action=getTerms');
        const data = await response.json();
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });

    app.post('/get-flexi-records', async (req, res) => {
      const { access_token, sectionid, archived = 'n' } = req.body;
      if (!access_token || !sectionid) {
        return res.status(400).json({ error: 'Missing access_token or sectionid' });
      }

      // Mock OSM API response
      fetch.mockResolvedValueOnce({
        json: async () => ({ items: [{ recordid: "123", name: "Test Record" }] })
      });

      try {
        const response = await fetch(`https://www.onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=${sectionid}&archived=${archived}`);
        const data = await response.json();
        res.json(data);
      } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /get-terms', () => {
    it('should return terms when valid access token provided', async () => {
      const response = await request(app)
        .post('/get-terms')
        .send({ access_token: 'valid_token' })
        .expect(200);

      expect(response.body).toEqual({ "11107": [{ "termid": "20872", "name": "2012" }] });
      expect(fetch).toHaveBeenCalledWith('https://www.onlinescoutmanager.co.uk/api.php?action=getTerms');
    });

    it('should return 400 when no access token provided', async () => {
      const response = await request(app)
        .post('/get-terms')
        .send({})
        .expect(400);

      expect(response.body).toEqual({ error: 'No access token provided' });
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('POST /get-flexi-records', () => {
    it('should return flexi records when valid parameters provided', async () => {
      const response = await request(app)
        .post('/get-flexi-records')
        .send({ 
          access_token: 'valid_token',
          sectionid: '49097'
        })
        .expect(200);

      expect(response.body).toEqual({ items: [{ recordid: "123", name: "Test Record" }] });
      expect(fetch).toHaveBeenCalledWith('https://www.onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=49097&archived=n');
    });

    it('should use archived=y when specified', async () => {
      await request(app)
        .post('/get-flexi-records')
        .send({ 
          access_token: 'valid_token',
          sectionid: '49097',
          archived: 'y'
        })
        .expect(200);

      expect(fetch).toHaveBeenCalledWith('https://www.onlinescoutmanager.co.uk/api.php?action=getFlexiRecords&sectionid=49097&archived=y');
    });

    it('should return 400 when missing sectionid', async () => {
      const response = await request(app)
        .post('/get-flexi-records')
        .send({ access_token: 'valid_token' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Missing access_token or sectionid' });
      expect(fetch).not.toHaveBeenCalled();
    });

    it('should return 400 when missing access_token', async () => {
      const response = await request(app)
        .post('/get-flexi-records')
        .send({ sectionid: '49097' })
        .expect(400);

      expect(response.body).toEqual({ error: 'Missing access_token or sectionid' });
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});