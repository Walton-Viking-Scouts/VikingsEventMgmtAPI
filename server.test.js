// Updated tests for GET endpoints

describe('GET /get-terms', () => {
    it('should return terms when access_token is provided', async () => {
        const response = await request(app)
            .get('/get-terms')
            .query({ access_token: 'test-token' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('terms');
    });
});

describe('GET /get-section-config', () => {
    it('should return section config when access_token and sectionid are provided', async () => {
        const response = await request(app)
            .get('/get-section-config')
            .query({ access_token: 'test-token', sectionid: '123' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('config');
    });
});

describe('GET /get-user-roles', () => {
    it('should return user roles when access_token is provided', async () => {
        const response = await request(app)
            .get('/get-user-roles')
            .query({ access_token: 'test-token' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('roles');
    });
});

describe('GET /get-events', () => {
    it('should return events when access_token, sectionid, and termid are provided', async () => {
        const response = await request(app)
            .get('/get-events')
            .query({ access_token: 'test-token', sectionid: '123', termid: '456' });
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('events');
    });
});